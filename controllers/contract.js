const mongoose = require("mongoose");
const Client = require("../models/client");
const Property = require("../models/property");
const Task = require("../models/task");
const Contract = require("../models/contract");
const { getFileUrl } = require("../functions/common");
const formatNumber = require("../utils/formatNumber");
const getNextSequence = require("../utils/getNextSequence");


/**Super Admin */

exports.createContract = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const {
      contractType,
      startDate,
      endDate,
      company,
      client,
      property,
      tasks = [],
    } = req.body;
    if (req.files?.clientLogo?.length) {
      client.clientLogo = req.files.clientLogo[0].path;
    }

    const additionalDocuments =
      req.files?.additionalDocuments?.map((file) => ({
        fileName: file.originalname,
        fileUrl: file.path,
      })) || [];

    const createdClient = await Client.create(
      [{ ...client, company }],
      { session }
    );
    const createdProperty = await Property.create(
      [
        {
          ...property,
          client: createdClient[0]._id,
        },
      ],
      { session }
    );

    const taskDocs = tasks.map((task) => ({
      ...task,
      company,
      assignedBy: req.user._id,
    }));

    const createdTasks = taskDocs.length
      ? await Task.create(taskDocs, { session })
      : [];

    const totalTasks = createdTasks.length;
    const totalTimeDays = createdTasks.reduce(
      (sum, t) => sum + (t.taskTime || 0),
      0
    );
    const totalCost = createdTasks.reduce(
      (sum, t) => sum + (t.taskPrice || 0),
      0
    );
  const invoiceSeq = await getNextSequence("invoice", session);
    const referenceSeq = await getNextSequence("reference", session);

    const invoiceNumber = formatNumber("RUNIV", invoiceSeq, 2); 
    const referenceNumber = formatNumber("INV", referenceSeq, 3);
    const contractNumber = `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const contract = await Contract.create(
      [
        {
          contractNumber,
          invoiceNumber,
          referenceNumber,
          contractType,
          startDate,
          endDate,
          client: createdClient[0]._id,
          property: createdProperty[0]._id,
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
    const {
      contractType,
      startDate,
      endDate,
      client,
      property,
      tasks = [],
    } = req.body;
    const company = req.user.company;

    if (req.files?.clientLogo?.length) {
      client.clientLogo = req.files.clientLogo[0].path;
    }

    const additionalDocuments =
      req.files?.additionalDocuments?.map((file) => ({
        fileName: file.originalname,
        fileUrl: file.path,
      })) || [];

    const createdClient = await Client.create(
      [{ ...client, company }],
      { session }
    );

    const createdProperty = await Property.create(
      [
        {
          ...property,
          client: createdClient[0]._id,
        },
      ],
      { session }
    );

    const taskDocs = tasks.map((task) => ({
      ...task,
      company,
      assignedBy: req.user._id,
    }));

    const createdTasks = taskDocs.length
      ? await Task.create(taskDocs, { session })
      : [];

    const totalTasks = createdTasks.length;
    const totalTimeDays = createdTasks.reduce(
      (sum, t) => sum + (t.taskTime || 0),
      0
    );
    const totalCost = createdTasks.reduce(
      (sum, t) => sum + (t.taskPrice || 0),
      0
    );
    const invoiceSeq = await getNextSequence("invoice", session);
    const referenceSeq = await getNextSequence("reference", session);

    const invoiceNumber = formatNumber("RUNIV", invoiceSeq, 2); 
    const referenceNumber = formatNumber("INV", referenceSeq, 3);
    const contractNumber = `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const contract = await Contract.create(
      [
        {
          contractNumber,
          invoiceNumber,
          referenceNumber,
          contractType,
          startDate,
          endDate,
          client: createdClient[0]._id,
          property: createdProperty[0]._id,
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


exports.getCompanyAdminContracts = async (req, res) => {
  try {
    const user = req.user;

    if (user.role.name !== "company_admin") {
      return res.status(403).json({
        message: "Only company admin can access contracts",
      });
    }
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
    } = req.query;

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
          c.client?.name?.toLowerCase().includes(keyword)
      );
    }

    contracts = contracts.map((contract) => {
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
      data: contract,
    });
  } catch (error) {
    console.error("Get single contract error:", error);
    return res.status(500).json({
      message: "Failed to fetch contract",
    });
  }
};
