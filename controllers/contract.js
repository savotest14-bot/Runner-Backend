const mongoose = require("mongoose");
const Client = require("../models/client");
const Property = require("../models/property");
const Task = require("../models/task");
const Contract = require("../models/contract");
const Company = require("../models/company");
const { getFileUrl } = require("../functions/common");
const formatNumber = require("../utils/formatNumber");
const getNextSequence = require("../utils/getNextSequence");
const buildContractEmail = require("../services/emailTemplateBuilder");
const { sendSimpleMail } = require("../functions/sendSimpleMail");

/**Super Admin */

// exports.createContract = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     if (req.user.role.name !== "superAdmin") {
//       return res.status(403).json({ message: "Access denied" });
//     }

//     const {
//       contractType,
//       startDate,
//       endDate,
//       company,
//       client,
//       property,
//       tasks = [],
//     } = req.body;
//     if (req.files?.clientLogo?.length) {
//       client.clientLogo = req.files.clientLogo[0].path;
//     }

//     const additionalDocuments =
//       req.files?.additionalDocuments?.map((file) => ({
//         fileName: file.originalname,
//         fileUrl: file.path,
//       })) || [];

//     const createdClient = await Client.create([{ ...client, company }], {
//       session,
//     });
//     const createdProperty = await Property.create(
//       [
//         {
//           ...property,
//           client: createdClient[0]._id,
//         },
//       ],
//       { session },
//     );

//     const taskDocs = tasks.map((task) => ({
//       ...task,
//       company,
//       assignedBy: req.user._id,
//     }));

//     const createdTasks = taskDocs.length
//       ? await Task.create(taskDocs, { session })
//       : [];

//     const totalTasks = createdTasks.length;
//     const totalTimeDays = createdTasks.reduce(
//       (sum, t) => sum + (t.taskTime || 0),
//       0,
//     );
//     const totalCost = createdTasks.reduce(
//       (sum, t) => sum + (t.taskPrice || 0),
//       0,
//     );
//     const invoiceSeq = await getNextSequence("invoice", session);
//     const referenceSeq = await getNextSequence("reference", session);

//     const invoiceNumber = formatNumber("RUNIV", invoiceSeq, 2);
//     const referenceNumber = formatNumber("INV", referenceSeq, 3);
//     const contractNumber = `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

//     const contract = await Contract.create(
//       [
//         {
//           contractNumber,
//           invoiceNumber,
//           referenceNumber,
//           contractType,
//           startDate,
//           endDate,
//           client: createdClient[0]._id,
//           property: createdProperty[0]._id,
//           tasks: createdTasks.map((t) => t._id),
//           totalTasks,
//           totalTimeDays,
//           totalCost,
//           company,
//           createdBy: req.user._id,
//           additionalDocuments,
//         },
//       ],
//       { session },
//     );

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       message: "Contract created successfully",
//       data: contract[0],
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();

//     console.error(err);
//     res.status(500).json({ message: "Failed to create contract" });
//   }
// };

const parseIfString = (data, fieldName) => {
  try {
    if (typeof data === "string") {
      return JSON.parse(data);
    }
    return data;
  } catch (err) {
    throw new Error(`Invalid JSON format in field: ${fieldName}`);
  }
};
exports.createContract = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    let {
      contractType,
      startDate,
      endDate,
      company,
      client,
      property,
      tasks = [],
    } = req.body;

    try {
      client = parseIfString(client, "client");
      property = parseIfString(property, "property");
      tasks = parseIfString(tasks, "tasks");
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    const companyDetails = await Company.findOne(
      { _id: company },
    );

    function convertToDays(duration, unit) {
      duration = Number(duration) || 0;

      switch (unit) {
        case "years":
          return duration * 365;
        case "months":
          return duration * 30;
        case "days":
          return duration;
        case "hours":
          return duration / 24;
        case "minutes":
          return duration / (24 * 60);
        case "seconds":
          return duration / (24 * 60 * 60);
        default:
          return 0;
      }
    }

    // ================= CLIENT LOGO =================

    if (req.files?.clientLogo?.length) {
      client.clientLogo = req.files.clientLogo[0].path;
    }

    const additionalDocuments =
      req.files?.additionalDocuments?.map((file) => ({
        fileName: file.originalname,
        fileUrl: file.path,
      })) || [];

    const [createdClient] = await Client.create(
      [{ ...client, company }],
      { session }
    );

    const [createdProperty] = await Property.create(
      [
        {
          ...property,
          client: createdClient._id,
        },
      ],
      { session }
    );

    const createdTasks = [];

    for (const task of tasks) {
      const [createdTask] = await Task.create(
        [
          {
            taskName: task.taskName,
            taskCategory: task.taskCategory,
            taskSubCategory: task.taskSubCategory,

            taskDuration: Number(task.taskDuration),
            taskDurationUnit: task.taskDurationUnit,

            taskPrice: Number(task.taskPrice) || 0,
            description: task.description,
            dueDate: task.dueDate,

            company,
            assignedTo: task.assignedTo || [],
            assignedBy: req.user._id,

            // ✅ TIMER NOT STARTED YET
            timerStartedAt: null,
            timerCompletedAt: null,
            taskEndAt: null,

            status: "pending",
          },
        ],
        { session }
      );

      createdTasks.push(createdTask);
    }

    // ================= CALCULATIONS =================

    const freshTasks = await Task.find(
      { _id: { $in: createdTasks.map(t => t._id) } },
      null,
      { session }
    );

    const totalTasks = freshTasks.length;

    const totalTimeDays = freshTasks.reduce((sum, t) => {
      return sum + convertToDays(t.taskDuration, t.taskDurationUnit);
    }, 0);
    const totalCost = freshTasks.reduce((sum, t) => {
      return sum + (Number(t.taskPrice) || 0);
    }, 0);

    // ================= NUMBERS =================

    const invoiceSeq = await getNextSequence("invoice", session);
    const referenceSeq = await getNextSequence("reference", session);

    const invoiceNumber = formatNumber("RUNIV", invoiceSeq, 2);
    const referenceNumber = formatNumber("INV", referenceSeq, 3);

    const contractNumber = `CON-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    // ================= CREATE CONTRACT =================

    const [contract] = await Contract.create(
      [
        {
          contractNumber,
          invoiceNumber,
          referenceNumber,
          contractType,
          startDate,
          endDate,

          client: createdClient._id,
          property: createdProperty._id,

          tasks: createdTasks.map((t) => t._id),

          totalTasks,
          totalTimeDays,
          totalCost,

          company,
          createdBy: req.user._id,
          additionalDocuments,
        },
      ],
      { session }
    );


    await session.commitTransaction();
    session.endSession();

    try {

      const emailHtml = await buildContractEmail({
        contract,
        client: createdClient,
        company: companyDetails,
        templateCode: req.body.emailTemplateCode || "invoice_v1",
        themeName: req.body.theme || "blue",
        frontendUrl: process.env.BACKEND_URL
      });

      await sendSimpleMail({
        to: createdClient.email,
        subject: `Invoice ${contract.invoiceNumber}`,
        html: emailHtml
      });

      contract.emailStatus = "sent";
      await contract.save();

    } catch (emailError) {
      console.error("Email send failed:", emailError);
    }

    res.status(201).json({
      success: true,
      message: "Contract created successfully",
      data: contract[0],
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error(err);
    res.status(500).json({ message: "Failed to create contract" });
  }
};

exports.getSingleContractBySuperAdmin = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({
        message: "Only super admin can access this contract",
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid contract id",
      });
    }

    const contract = await Contract.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate("client", "name email phone city country clientLogo")
      .populate("property", "propertyName propertyType sizeSqm")
      .populate("company", "companyName")
      .populate("createdBy", "firstName lastName email")
      .populate({
        path: "tasks",
        select:
          "taskName taskCategory taskSubCategory taskTime taskPrice status assignedTo dueDate",
        populate: {
          path: "assignedTo",
          select: "firstName lastName email",
        },
      })
      .lean();

    if (!contract) {
      return res.status(404).json({
        message: "Contract not found",
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
      data: contract,
    });
  } catch (error) {
    console.error("Get contract by superAdmin error:", error);
    return res.status(500).json({
      message: "Failed to fetch contract",
    });
  }
};

exports.getAllContracts = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const contracts = await Contract.find({ isDeleted: false })
      .populate("client", "name email city clientLogo")
      .populate("property", "propertyName")
      .populate("company", "companyName")
      .populate("tasks", "taskName taskPrice")
      .lean();

    const formattedContracts = contracts.map((contract) => {
      if (contract.client?.clientLogo) {
        contract.client.clientLogo = getFileUrl(
          req,
          contract.client.clientLogo,
        );
      }

      if (contract.additionalDocuments?.length) {
        contract.additionalDocuments = contract.additionalDocuments.map(
          (doc) => ({
            ...doc,
            fileUrl: getFileUrl(req, doc.fileUrl),
          }),
        );
      }

      return contract;
    });

    res.status(200).json({
      success: true,
      data: formattedContracts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch contracts" });
  }
};

exports.getSingleContractBySuperAdmin = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({
        message: "Only super admin can access this contract",
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid contract id",
      });
    }

    const contract = await Contract.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate("client", "name email phone city country clientLogo")
      .populate("property", "propertyName propertyType sizeSqm")
      .populate("company", "companyName")
      .populate("createdBy", "firstName lastName email")
      .populate({
        path: "tasks",
        select:
          "taskName taskCategory taskSubCategory taskTime taskPrice status assignedTo dueDate",
        populate: {
          path: "assignedTo",
          select: "firstName lastName email",
        },
      })
      .lean();

    if (!contract) {
      return res.status(404).json({
        message: "Contract not found",
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
      data: contract,
    });
  } catch (error) {
    console.error("Get contract by superAdmin error:", error);
    return res.status(500).json({
      message: "Failed to fetch contract",
    });
  }
};

/**Company Admin */


exports.createContractByCompanyAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (req.user.role.name !== "company_admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    let {
      contractType,
      startDate,
      endDate,
      client,
      property,
      tasks = [],
    } = req.body;
    try {
      client = parseIfString(client, "client");
      property = parseIfString(property, "property");
      tasks = parseIfString(tasks, "tasks");
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    const company = req.user.company;

    const companyDetails = await Company.findOne(
      { _id: company },
    );

    // ================= HELPER FUNCTION =================

    function convertToDays(duration, unit) {
      duration = Number(duration) || 0;

      switch (unit) {
        case "years":
          return duration * 365;
        case "months":
          return duration * 30;
        case "days":
          return duration;
        case "hours":
          return duration / 24;
        case "minutes":
          return duration / (24 * 60);
        case "seconds":
          return duration / (24 * 60 * 60);
        default:
          return 0;
      }
    }

    // ================= CLIENT LOGO =================

    if (req.files?.clientLogo?.length) {
      client.clientLogo = req.files.clientLogo[0].path;
    }

    const additionalDocuments =
      req.files?.additionalDocuments?.map((file) => ({
        fileName: file.originalname,
        fileUrl: file.path,
      })) || [];

    // ================= CREATE CLIENT =================

    const [createdClient] = await Client.create(
      [{ ...client, company }],
      { session }
    );

    // ================= CREATE PROPERTY =================

    const [createdProperty] = await Property.create(
      [
        {
          ...property,
          client: createdClient._id,
        },
      ],
      { session }
    );

    // ================= CREATE TASKS (NO TIMER START HERE) =================

    const createdTasks = [];

    for (const task of tasks) {
      const [createdTask] = await Task.create(
        [
          {
            taskName: task.taskName,
            taskCategory: task.taskCategory,
            taskSubCategory: task.taskSubCategory,

            taskDuration: Number(task.taskDuration),
            taskDurationUnit: task.taskDurationUnit,

            taskPrice: Number(task.taskPrice) || 0,
            description: task.description,
            dueDate: task.dueDate,

            company,
            assignedTo: task.assignedTo || [],
            assignedBy: req.user._id,

            // ✅ TIMER NOT STARTED YET
            timerStartedAt: null,
            timerCompletedAt: null,
            taskEndAt: null,

            status: "pending",
          },
        ],
        { session }
      );

      createdTasks.push(createdTask);
    }

    // ================= CALCULATIONS =================

    const freshTasks = await Task.find(
      { _id: { $in: createdTasks.map(t => t._id) } },
      null,
      { session }
    );

    const totalTasks = freshTasks.length;

    const totalTimeDays = freshTasks.reduce((sum, t) => {
      return sum + convertToDays(t.taskDuration, t.taskDurationUnit);
    }, 0);
    const totalCost = freshTasks.reduce((sum, t) => {
      return sum + (Number(t.taskPrice) || 0);
    }, 0);

    // ================= NUMBERS =================

    const invoiceSeq = await getNextSequence("invoice", session);
    const referenceSeq = await getNextSequence("reference", session);

    const invoiceNumber = formatNumber("RUNIV", invoiceSeq, 2);
    const referenceNumber = formatNumber("INV", referenceSeq, 3);

    const contractNumber = `CON-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    // ================= CREATE CONTRACT =================

    const [contract] = await Contract.create(
      [
        {
          contractNumber,
          invoiceNumber,
          referenceNumber,
          contractType,
          startDate,
          endDate,

          client: createdClient._id,
          property: createdProperty._id,

          tasks: createdTasks.map((t) => t._id),

          totalTasks,
          totalTimeDays,
          totalCost,

          company,
          createdBy: req.user._id,
          additionalDocuments,
        },
      ],
      { session }
    );


    await session.commitTransaction();
    session.endSession();

    try {

      const emailHtml = await buildContractEmail({
        contract,
        client: createdClient,
        company: companyDetails,
        templateCode: req.body.emailTemplateCode || "invoice_v1",
        themeName: req.body.theme || "blue",
        frontendUrl: process.env.BACKEND_URL
      });

      await sendSimpleMail({
        to: createdClient.email,
        subject: `Invoice ${contract.invoiceNumber}`,
        html: emailHtml
      });

      contract.emailStatus = "sent";
      await contract.save();

    } catch (emailError) {
      console.error("Email send failed:", emailError);
    }

    res.status(201).json({
      success: true,
      message: "Contract created successfully",
      data: contract,
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("CREATE CONTRACT ERROR:", err);

    res.status(500).json({
      message: err.message || "Failed to create contract",
    });
  }
};


exports.getCompanyAdminContracts = async (req, res) => {
  try {
    const user = req.user;

    if (user.role.name !== "company_admin") {
      return res.status(403).json({
        message: "Only company admin can access contracts",
      });
    }
    const { page = 1, limit = 10, search = "", status } = req.query;

    const skip = (page - 1) * limit;

    const filter = {
      company: user.company,
      isDeleted: false,
    };

    if (status) {
      filter.status = status;
    }

    let contracts = await Contract.find(filter)
      .populate("client", "name email city country clientLogo")
      .populate("property", "propertyName propertyType")
      .populate("company", "companyName")
      .populate("createdBy", "firstName lastName email")
      .populate({
        path: "tasks",
        select: "taskName taskTime taskPrice status",
      })
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    if (search) {
      const keyword = search.toLowerCase();
      contracts = contracts.filter(
        (c) =>
          c.contractNumber?.toLowerCase().includes(keyword) ||
          c.client?.name?.toLowerCase().includes(keyword),
      );
    }

    contracts = contracts.map((contract) => {
      if (contract.client?.clientLogo) {
        contract.client.clientLogo = getFileUrl(
          req,
          contract.client.clientLogo,
        );
      }

      if (contract.additionalDocuments?.length) {
        contract.additionalDocuments = contract.additionalDocuments.map(
          (doc) => ({
            ...doc,
            fileUrl: getFileUrl(req, doc.fileUrl),
          }),
        );
      }

      return contract;
    });

    const total = await Contract.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: contracts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get company admin contracts error:", error);
    return res.status(500).json({
      message: "Failed to fetch contracts",
    });
  }
};

exports.getSingleCompanyAdminContract = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (user.role.name !== "company_admin") {
      return res.status(403).json({
        message: "Only company admin can access this contract",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid contract id",
      });
    }

    const contract = await Contract.findOne({
      _id: id,
      company: user.company,
      isDeleted: false,
    })
      .populate("client", "name email phone city country clientLogo")
      .populate("property", "propertyName propertyType sizeSqm")
      .populate("company", "companyName")
      .populate("createdBy", "firstName lastName email")
      .populate({
        path: "tasks",
        select:
          "taskName taskCategory taskSubCategory taskTime taskPrice status assignedTo dueDate",
        populate: {
          path: "assignedTo",
          select: "firstName lastName email",
        },
      })
      .lean();

    if (!contract) {
      return res.status(404).json({
        message: "Contract not found",
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
      data: contract,
    });
  } catch (error) {
    console.error("Get single contract error:", error);
    return res.status(500).json({
      message: "Failed to fetch contract",
    });
  }
};


exports.contractEmailResponse = async (req, res) => {
  try {
    const { contractId, action } = req.query;

    if (!contractId || !action) {
      return res.status(400).send("Invalid request");
    }

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).send("Invalid action");
    }

    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).send("Contract not found");
    }

    if (
      contract.emailStatus === "accepted" ||
      contract.emailStatus === "rejected"
    ) {
      return res
        .status(409)
        .send("You have already responded to this contract");
    }

    if (action === "accept") {
      contract.emailStatus = "accepted";
      contract.clinetStatus = "accepted";
    } else if (action === "reject") {
      contract.emailStatus = "rejected";
      contract.clinetStatus = "rejected";
    }

    contract.emailRespondedAt = new Date();

    await contract.save();

    return res.send("Response recorded successfully");

  } catch (error) {
    console.error("Contract email response error:", error);
    return res.status(500).send("Failed to process response");
  }
};

