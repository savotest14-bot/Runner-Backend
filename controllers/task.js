const Contract = require("../models/contract");
const { getFileUrl } = require("../functions/common");
const Task = require("../models/task");
const User = require("../models/user");
const mongoose = require("mongoose");

exports.getAllTasksForCompanyAdmin = async (req, res) => {
  try {
    const user = req.user;

    if (user.role.name !== "company_admin") {
      return res.status(403).json({
        message: "Only company admin can access tasks",
      });
    }

    const { page = 1, limit = 10, status, contractId } = req.query;

    const skip = (page - 1) * limit;

    const filter = {
      company: user.company,
      isDeleted: false,
    };

    if (status) {
      filter.status = status;
    }

    let taskIdsFromContract = null;
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

      taskIdsFromContract = contract.tasks;
      filter._id = { $in: taskIdsFromContract };
    }

    const tasks = await Task.find(filter)
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName email")
      .populate("company", "companyName")
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

    if (user.role.name !== "company_admin") {
      return res.status(403).json({
        message: "Only company admin can access tasks",
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
      .populate("assignedTo", "firstName lastName email phone")
      .populate("assignedBy", "firstName lastName email")
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

    if (contract.client?.clientLogo) {
      contract.client.clientLogo = getFileUrl(req, contract.client.clientLogo);
    }

    if (contract.additionalDocuments?.length) {
      contract.additionalDocuments = contract.additionalDocuments.map(
        (doc) => ({
          ...doc,
          fileUrl: getFileUrl(req, doc.fileUrl),
        }),
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
  ids.filter(id => mongoose.Types.ObjectId.isValid(id));

exports.assignUsersToTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    let { userIds, removeUserIds } = req.body;

    const task = await Task.findById(taskId);
    if (!task || task.isDeleted) {
      return res.status(404).json({ message: "Task not found" });
    }

    // ===== REMOVE FIRST =====
    if (Array.isArray(removeUserIds) && removeUserIds.length > 0) {

      removeUserIds = filterValidObjectIds(removeUserIds);

      if (removeUserIds.length > 0) {
        await Task.findByIdAndUpdate(taskId, {
          $pull: { assignedTo: { $in: removeUserIds } }
        });
      }
    }

    // ===== ADD AFTER =====
    if (Array.isArray(userIds) && userIds.length > 0) {

      userIds = filterValidObjectIds(userIds);

      if (userIds.length > 0) {

        const validAddUsers = await User.find({
          _id: { $in: userIds },
          isDeleted: false
        }).select("_id");

        const validAddUserIds = validAddUsers.map(u => u._id);

        await Task.findByIdAndUpdate(taskId, {
          $addToSet: {
            assignedTo: { $each: validAddUserIds }
          },
          assignedBy: req.user._id
        });
      }
    }

    const updatedTask = await Task.findById(taskId)
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "Task users updated successfully",
      data: updatedTask,
    });

  } catch (error) {
    console.error("Assign/remove users error:", error);
    res.status(500).json({
      message: "Failed to update task users",
    });
  }
};


exports.removeUsersFromTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        message: "userIds must be a non-empty array",
      });
    }

    const task = await Task.findById(taskId);
    if (!task || task.isDeleted) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      {
        $pull: {
          assignedTo: { $in: userIds },
        },
      },
      { new: true }
    )
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName");

    return res.status(200).json({
      success: true,
      message: "Users removed from task successfully",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Remove users error:", error);
    return res.status(500).json({
      message: "Failed to remove users",
    });
  }
};



exports.startTaskTimer = async (req, res) => {
  try {
    const { taskId } = req.params;

    const employeeId = req.user._id;

    const task = await Task.findOne({
      _id: taskId,
      assignedTo: employeeId,
      isDeleted: false,
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found or not assigned to you",
      });
    }

    // Prevent restart
    if (task.timerStartedAt) {
      return res.status(400).json({
        message: "Timer already started",
      });
    }

    // ===== Helper Function =====
    function calculateTaskEnd(startDate, duration, unit) {
      const end = new Date(startDate);

      switch (unit) {
        case "years":
          end.setFullYear(end.getFullYear() + duration);
          break;
        case "months":
          end.setMonth(end.getMonth() + duration);
          break;
        case "days":
          end.setDate(end.getDate() + duration);
          break;
        case "hours":
          end.setHours(end.getHours() + duration);
          break;
        case "minutes":
          end.setMinutes(end.getMinutes() + duration);
          break;
        case "seconds":
          end.setSeconds(end.getSeconds() + duration);
          break;
      }

      return end;
    }

    // ===== Start Timer =====
    const now = new Date();

    task.timerStartedAt = now;

    task.taskEndAt = calculateTaskEnd(
      now,
      Number(task.taskDuration),
      task.taskDurationUnit
    );

    task.status = "in_progress";

    await task.save();

    res.status(200).json({
      success: true,
      message: "Task timer started",
      data: {
        timerStartedAt: task.timerStartedAt,
        taskEndAt: task.taskEndAt,
      },
    });

  } catch (error) {
    console.error("Start task timer error:", error);
    res.status(500).json({
      message: "Failed to start task timer",
    });
  }
};
