const Contract = require("../models/contract");
const { getFileUrl } = require("../functions/common");
const Task = require("../models/task");
const User = require("../models/user");
const mongoose = require("mongoose");
const SubTask = require("../models/subtask");
const Property = require("../models/property");
const fs = require("fs");
const WorkReport = require("../models/WorkReport");
const Group = require("../models/group")


exports.getAllTasksForCompanyAdmin = async (req, res) => {
  try {
    const user = req.user;

    const { page = 1, limit = 10, status, contractId } = req.query;

    const skip = (page - 1) * limit;

    let filter = {
      company: user.company,
      isDeleted: false,
    };

    // ================= ROLE LOGIC =================

    if (user.role.name === "company_admin") {
      // ✅ company_admin → see all tasks (no extra filter)
    } else {
      // 👷 employee → check if GROUP_ADMIN in any group

      const groups = await Group.find({
        company: user.company,
        isDeleted: false,
        "members.user": user._id,
        "members.role": "GROUP_ADMIN",
        assignmentType: "TASK",
      }).select("task");

      const taskIds = groups.map((g) => g.task).filter(Boolean);

      // ❌ if not group admin anywhere → no access
      if (!taskIds.length) {
        return res.status(200).json({
          success: true,
          totalTasks: 0,
          data: [],
        });
      }

      // ✅ restrict tasks
      filter._id = { $in: taskIds };
    }

    // ================= STATUS FILTER =================
    if (status) {
      filter.status = status;
    }

    // ================= CONTRACT FILTER =================
    if (contractId) {
      const contract = await Contract.findOne({
        _id: contractId,
        company: user.company,
        isDeleted: false,
      }).select("tasks");

      if (!contract) {
        return res.status(404).json({
          message: "Contract not found",
        });
      }

      // combine filters
      filter._id = filter._id
        ? { $in: contract.tasks.filter(id => filter._id.$in.includes(id.toString())) }
        : { $in: contract.tasks };
    }

    // ================= FETCH TASKS =================
    const tasks = await Task.find(filter)
      .populate("assignedBy", "firstName lastName email")
      .populate("company", "companyName")
      .populate({
        path: "subTasks",
        populate: {
          path: "assignedTo",
          select: "firstName lastName email",
        },
      })
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await Task.countDocuments(filter);

    return res.status(200).json({
      success: true,
      totalTasks: total,
      page: Number(page),
      limit: Number(limit),
      data: tasks,
    });

  } catch (error) {
    console.error("Get all tasks error:", error);
    return res.status(500).json({
      message: "Failed to fetch tasks",
    });
  }
};

exports.getTaskByIdForCompanyAdmin = async (req, res) => {
  try {
    const user = req.user;
    const { taskId } = req.params;

    if (
      !user ||
      !user.role ||
      !["group_admin", "company_admin", "employee"].includes(user.role.name)
    ) {
      return res.status(403).json({
        message: "You do not have access to this route",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        message: "Invalid task id",
      });
    }

    const task = await Task.findOne({
      _id: taskId,
      company: user.company,
      isDeleted: false,
    })
      .populate("assignedBy", "firstName lastName email")

      // ✅ FIXED: SUBTASK POPULATION
      .populate({
        path: "subTasks",
        populate: {
          path: "assignedTo",
          select: "firstName lastName email phone",
        },
      })

      .lean();

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const contract = await Contract.findOne({
      tasks: task._id,
      company: user.company,
      isDeleted: false,
    })
      .populate("client")
      .populate("property")
      .lean();

    if (!contract) {
      return res.status(404).json({
        message: "Contract not found for this task",
      });
    }

    // ✅ FILE URL FIX
    if (contract.client?.clientLogo) {
      contract.client.clientLogo = getFileUrl(
        req,
        contract.client.clientLogo
      );
    }

    if (contract.additionalDocuments?.length) {
      contract.additionalDocuments = contract.additionalDocuments.map(
        (doc) => ({
          ...doc,
          fileUrl: getFileUrl(req, doc.fileUrl),
        })
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        task,
        contract: {
          _id: contract._id,
          contractNumber: contract.contractNumber,
          contractType: contract.contractType,
          startDate: contract.startDate,
          endDate: contract.endDate,
          status: contract.status,
          totalCost: contract.totalCost,
        },
        client: contract.client,
        property: contract.property,
      },
    });

  } catch (error) {
    console.error("Get task by id error:", error);
    return res.status(500).json({
      message: "Failed to fetch task details",
    });
  }
};

const filterValidObjectIds = (ids = []) =>
  ids.filter((id) => mongoose.Types.ObjectId.isValid(id));

exports.assignUsersToSubTask = async (req, res) => {
  try {
    const { subTaskId } = req.params;
    let { userIds, removeUserIds } = req.body;
    console.log("hhhhhhhhhhhhhhhhhh")
    const subTask = await SubTask.findById(subTaskId);

    if (!subTask) {
      return res.status(404).json({ message: "SubTask not found" });
    }

    // ===== REMOVE USERS =====
    if (Array.isArray(removeUserIds) && removeUserIds.length > 0) {
      removeUserIds = filterValidObjectIds(removeUserIds);

      if (removeUserIds.length > 0) {
        await SubTask.findByIdAndUpdate(subTaskId, {
          $pull: { assignedTo: { $in: removeUserIds } },
        });
      }
    }

    // ===== ADD USERS =====
    if (Array.isArray(userIds) && userIds.length > 0) {
      userIds = filterValidObjectIds(userIds);

      if (userIds.length > 0) {
        const validUsers = await User.find({
          _id: { $in: userIds },
          isDeleted: false,
        }).select("_id");

        const validUserIds = validUsers.map((u) => u._id);

        await SubTask.findByIdAndUpdate(subTaskId, {
          $addToSet: {
            assignedTo: { $each: validUserIds },
          },
          assignedBy: req.user._id,
        });
      }
    }

    const updatedSubTask = await SubTask.findById(subTaskId)
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "SubTask users updated successfully",
      data: updatedSubTask,
    });

  } catch (error) {
    console.error("Assign/remove users error:", error);
    return res.status(500).json({
      message: "Failed to update subtask users",
    });
  }
};


exports.removeUsersFromSubTask = async (req, res) => {
  try {
    const { subTaskId } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        message: "userIds must be a non-empty array",
      });
    }

    // ✅ VALIDATE IDS
    const validUserIds = userIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validUserIds.length === 0) {
      return res.status(400).json({
        message: "No valid userIds provided",
      });
    }

    const subTask = await SubTask.findById(subTaskId);

    if (!subTask) {
      return res.status(404).json({
        message: "SubTask not found",
      });
    }

    const updatedSubTask = await SubTask.findByIdAndUpdate(
      subTaskId,
      {
        $pull: {
          assignedTo: { $in: validUserIds },
        },
      },
      { new: true }
    )
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "Users removed from subtask successfully",
      data: updatedSubTask,
    });

  } catch (error) {
    console.error("Remove users error:", error);
    return res.status(500).json({
      message: "Failed to remove users",
    });
  }
};



exports.startSubTaskTimer = async (req, res) => {
  try {
    const { subTaskId } = req.params;
    const employeeId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(subTaskId)) {
      return res.status(400).json({
        message: "Invalid subTask id",
      });
    }

    const startTime = new Date();

    const subTask = await SubTask.findOne({
      _id: subTaskId,
      assignedTo: { $in: [employeeId] },
      timerStartedAt: null,
      status: "pending",
    });

    if (!subTask) {
      return res.status(400).json({
        message:
          "SubTask not found, not assigned, already started, or not in pending state",
      });
    }

    // ✅ FIXED LOGIC
    const duration = Number(subTask.estimatedDurationSeconds) || 0;

    let expectedEndTime = null;

    if (duration > 0) {
      expectedEndTime = new Date(
        startTime.getTime() + duration * 1000
      );
    }

    console.log("Estimated:", duration);
    console.log("ExpectedEndTime:", expectedEndTime);

    subTask.timerStartedAt = startTime;
    subTask.expectedEndTime = expectedEndTime;
    subTask.status = "in_progress";

    await subTask.save();

    await Task.findOneAndUpdate(
      {
        _id: subTask.task,
        status: "pending",
      },
      {
        status: "in_progress",
      }
    );

    return res.status(200).json({
      success: true,
      message: "SubTask timer started successfully",
      data: {
        subTaskId: subTask._id,
        timerStartedAt: subTask.timerStartedAt,
        expectedEndTime: subTask.expectedEndTime,
        status: subTask.status,
      },
    });

  } catch (error) {
    console.error("Start subtask timer error:", error);
    return res.status(500).json({
      message: "Failed to start subtask timer",
    });
  }
};


const generateWorkReport = async (taskId, session) => {

  const existingReport = await WorkReport.findOne({ task: taskId }).session(session);
  if (existingReport) return existingReport;

  const subTasks = await SubTask.find({
    task: taskId,
    status: "completed",
  }).session(session);

  const contract = await Contract.findOne({ tasks: taskId }).session(session);
  if (!contract) throw new Error("Contract not found");

  let totalSeconds = 0;
  const employeeMap = {};

  const completedSubTasks = subTasks.map((s) => {
    const time = s.totalTimeSeconds || 0;
    totalSeconds += time;

    s.assignedTo.forEach((empId) => {
      const id = empId.toString();

      if (!employeeMap[id]) {
        employeeMap[id] = {
          employee: empId,
          totalTimeSeconds: 0,
          totalTasks: 0,
          totalAmount: 0, // only for per_service
        };
      }

      employeeMap[id].totalTimeSeconds += time;
      employeeMap[id].totalTasks += 1;
      employeeMap[id].totalAmount += s.subtaskPrice || 0;
    });

    return {
      subTaskId: s._id,
      name: s.subTaskName,
      price: s.subtaskPrice, // reference only
      timeSeconds: time,
      assignedTo: s.assignedTo,
    };
  });

  return await WorkReport.create(
    [
      {
        task: taskId,
        contract: contract._id,
        employees: Object.keys(employeeMap),
        company: contract.company,
        employeeBreakdown: Object.values(employeeMap),
        totalTimeSeconds: totalSeconds,
        totalHours: totalSeconds / 3600,
        completedSubTasks,
        status: "draft",      // ✅ important
        isEditable: true,     // ✅ important
        reviewStatus:"pending"
      },
    ],
    { session }
  );
};


exports.stopSubTaskTimer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { subTaskId } = req.params;
    const employeeId = req.user._id;

    // ✅ Validate ID
    if (!mongoose.Types.ObjectId.isValid(subTaskId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subTask id",
      });
    }

    // ✅ Get subtask
    const subTask = await SubTask.findOne({
      _id: subTaskId,
      assignedTo: employeeId,
    }).session(session);

    if (!subTask) {
      throw new Error("SubTask not found or not assigned");
    }

    if (subTask.status === "completed") {
      throw new Error("SubTask already completed");
    }

    if (!subTask.timerStartedAt) {
      throw new Error("Timer not started");
    }

    const now = new Date();
    const startTime = new Date(subTask.timerStartedAt);

    const workedSeconds = Math.max(
      0,
      Math.floor((now - startTime) / 1000)
    );

    // ================= UPDATE SUBTASK =================

    subTask.totalTimeSeconds =
      (subTask.totalTimeSeconds || 0) + workedSeconds;

    subTask.timerCompletedAt = now;
    subTask.timerStartedAt = null;
    subTask.status = "completed";

    await subTask.save({ session });

    // ================= CHECK TASK STATUS =================

    const subTasks = await SubTask.find({
      task: subTask.task,
    }).session(session);

    const allCompleted = subTasks.every(
      (s) => s.status === "completed"
    );

    const taskStatus = allCompleted ? "completed" : "in_progress";

    await Task.findByIdAndUpdate(
      subTask.task,
      { status: taskStatus },
      { session }
    );

    // ================= GENERATE REPORT =================

    if (taskStatus === "completed") {
      await generateWorkReport(subTask.task, session);
    }

    // ================= COMMIT =================

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "SubTask timer stopped successfully",
      data: {
        subTaskId: subTask._id,
        workedSeconds,
        totalTimeSeconds: subTask.totalTimeSeconds,
        status: subTask.status,
        taskStatus,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Stop subtask timer error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to stop subtask timer",
    });
  }
};


exports.getMySubTasks = async (req, res) => {
  try {
    const employeeId = req.user._id;

    const { status, page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const filter = {
      assignedTo: employeeId,
      ...(status && { status }),
    };

    const subTasks = await SubTask.find(filter)
      .populate({
        path: "task",
        select: "taskName taskCategory taskSubCategory taskPrice status",
      })
      .populate("assignedBy", "firstName lastName email")

      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    const total = await SubTask.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: subTasks,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("Get my subtasks error:", error);
    return res.status(500).json({
      message: "Failed to fetch subtasks",
    });
  }
};

const cleanupFiles = (files) => {
  if (!files || files.length === 0) return;

  files.forEach(file => {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  });
};


exports.checkGeoFence = async (req, res, next) => {
  try {
    const { subTaskId } = req.params;
    const { lat, lng } = req.body;
    if (!lat || !lng) {
      cleanupFiles(req.files);
      return res.status(400).json({
        message: "Latitude and Longitude are required",
      });
    }

    const subTask = await SubTask.findById(subTaskId);
    if (!subTask) {
      cleanupFiles(req.files);
      return res.status(404).json({ message: "SubTask not found" });
    }

    const task = await Task.findById(subTask.task);
    const contract = await Contract.findOne({ tasks: task._id });
    const property = await Property.findById(contract.property);

    const isWithinRange = await Property.findOne({
      _id: property._id,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [Number(lng), Number(lat)],
          },
          $maxDistance: 1500,
        },
      },
    });

    if (!isWithinRange) {
      cleanupFiles(req.files); // 🔥 DELETE uploaded files
      return res.status(403).json({
        message: "You are not within 600 meters of the property",
      });
    }

    next();
  } catch (err) {
    cleanupFiles(req.files); // 🔥 safety cleanup
    console.error(err);
    res.status(500).json({ message: "Geo-fence check failed" });
  }
};

exports.uploadBeforeWorkImage = async (req, res) => {
  try {
    const { subTaskId } = req.params;
    const employeeId = req.user._id;

    const subTask = await SubTask.findById(subTaskId);

    if (!subTask) {
      return res.status(404).json({
        message: "SubTask not found",
      });
    }

    // ✅ Assignment Check
    const isAssigned = subTask.assignedTo.some(id =>
      id.equals(employeeId)
    );

    if (!isAssigned) {
      return res.status(403).json({
        message: "You are not assigned to this subtask",
      });
    }

    // ✅ Status Check
    if (!["pending", "in_progress"].includes(subTask.status)) {
      return res.status(400).json({
        message: "Only pending or in_process tasks can be updated",
      });
    }

    // ❗ FIX: Handle multiple files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "No images uploaded",
      });
    }
    const images = req.files.map(file => ({
      url: `uploads/workImage/${file.filename}`,
      uploadedBy: employeeId,
    }));

    subTask.beforeWorkImages.push(...images);

    await subTask.save();

    return res.status(200).json({
      success: true,
      message: "Before work images uploaded",
      data: subTask.beforeWorkImages,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Upload failed" });
  }
};


exports.uploadAfterWorkImage = async (req, res) => {
  try {
    const { subTaskId } = req.params;
    const employeeId = req.user._id;
    const { description } = req.body;

    const subTask = await SubTask.findById(subTaskId);

    if (!subTask) {
      return res.status(404).json({
        message: "SubTask not found",
      });
    }

    // ✅ Assignment Check
    const isAssigned = subTask.assignedTo.some(id =>
      id.equals(employeeId)
    );

    if (!isAssigned) {
      return res.status(403).json({
        message: "You are not assigned to this subtask",
      });
    }

    // ✅ Status Check
    if (subTask.status !== "completed") {
      return res.status(400).json({
        message: "Upload after-work image only after completion",
      });
    }

    // 🔥 CASE 1: Images uploaded
    if (req.files && req.files.length > 0) {
      const images = req.files.map(file => ({
        url: `uploads/workImage/${file.filename}`,
        uploadedBy: employeeId,
      }));

      subTask.afterWorkImages.push(...images);
    }

    // 🔥 CASE 2: Description update
    if (description) {
      subTask.afterWorkImagesdescription = description;
    }

    // ❌ Nothing provided
    if ((!req.files || req.files.length === 0) && !description) {
      return res.status(400).json({
        message: "Please upload image or provide description",
      });
    }

    await subTask.save();

    return res.status(200).json({
      success: true,
      message: "After work updated successfully",
      data: {
        images: subTask.afterWorkImages,
        description: subTask.afterWorkImagesdescription,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Upload failed" });
  }
};