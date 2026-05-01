const { deleteFileIfExists } = require("../functions/common");
const User = require("../models/user");
const WorkReport = require("../models/WorkReport");
const Invoice = require("../models/Invoice");
const EmployeePayment = require("../models/EmployeePayment")
const Contract = require("../models/contract");
const buildInvoiceEmail = require("../utils/emailTemplates/invoiceEmail");
const { sendSimpleMail } = require("../functions/sendSimpleMail");
const SubTask = require("../models/subtask");
const Payment = require("../models/Payment");
const EmployeeSalary = require("../models/EmployeeSalary");
const mongoose = require("mongoose");

exports.updateMyProfilePic = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        message: "Profile image is required",
      });
    }

    const newProfilePic =
      req.file.path || req.file.location || req.file.url;

    const user = await User.findOne({
      _id: userId,
      isDeleted: false,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.profilePic) {
      deleteFileIfExists(user.profilePic);
    }

    user.profilePic = newProfilePic;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePic: newProfilePic,
    });
  } catch (error) {
    console.error("Update profile pic error:", error);
    return res.status(500).json({
      message: "Failed to update profile picture",
    });
  }
};


exports.getAllWorkReports = async (req, res) => {
  try {
    const user = req.user;

    // ======================================================
    // ✅ PAGINATION
    // ======================================================
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    // ======================================================
    // ✅ QUERY PARAMS
    // ======================================================
    const { status, contractId, search, reviewStatus } = req.query;

    const filter = {};

    // ======================================================
    // ✅ ROLE CHECK
    // ======================================================
    const isSuperAdmin = user.role.name === "superAdmin";

    // 🔥 Company restriction for non-superAdmin
    if (!isSuperAdmin) {
      filter.company = user.company;
    }

    // ======================================================
    // ✅ STATUS FILTER
    // ======================================================
    if (status) {
      filter.status = status;
    }

    // ======================================================
    // ✅ REVIEW STATUS FILTER (NEW)
    // ======================================================
    if (reviewStatus) {
      filter.reviewStatus = reviewStatus;
    }

    // ======================================================
    // 🔍 CONTRACT FILTER LOGIC
    // ======================================================

    let contractIds = [];

    // 🔹 Direct contractId
    if (contractId) {
      contractIds = [contractId];
    }

    // 🔹 Search by contractNumber
    if (search) {
      const searchRegex = new RegExp(search, "i");

      const contractFilter = {
        contractNumber: searchRegex,
      };

      // 🔥 Apply company restriction in search
      if (!isSuperAdmin) {
        contractFilter.company = user.company;
      }

      const contracts = await Contract.find(contractFilter).select("_id");

      const searchContractIds = contracts.map(c => c._id.toString());

      if (contractIds.length) {
        // ✅ intersection (contractId + search)
        contractIds = contractIds.filter(id =>
          searchContractIds.includes(id.toString())
        );
      } else {
        contractIds = searchContractIds;
      }
    }

    // 🔹 Apply contract filter
    if (contractIds.length) {
      filter.contract = { $in: contractIds };
    }

    // 🔹 If search provided but no match → return empty
    if (search && contractIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No reports found",
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      });
    }

    // ======================================================
    // 📊 FETCH DATA
    // ======================================================
    const [reports, total] = await Promise.all([
      WorkReport.find(filter)
        .populate("task", "taskName status scheduledDate")
        .populate("contract", "contractNumber billingType")
        .populate("employees", "firstName lastName")
        .populate("reviewedBy", "firstName lastName")
        .populate("company", "companyName")
        .populate("employeeBreakdown.employee", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      WorkReport.countDocuments(filter),
    ]);

    // ======================================================
    // ✅ RESPONSE
    // ======================================================
    return res.status(200).json({
      success: true,
      message: "Work reports fetched successfully",
      data: reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("Get all reports error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
    });
  }
};

exports.getWorkReportDetails = async (req, res) => {
  try {
    const { reportId } = req.params;
    const user = req.user;

    const filter = { _id: reportId };

    // ✅ Company restriction
    if (user.role.name === "company_admin") {
      filter.company = user.company;
    }

    const report = await WorkReport.findOne(filter)
      // 🔹 Task
      .populate("task")

      // 🔹 Contract + Client + Property
      .populate({
        path: "contract",
        populate: [
          {
            path: "client",
            select: "name email phone",
          },
          {
            path: "property",
          },
        ],
      })

      // 🔹 Employees
      .populate("employees")

      // 🔹 Employee Breakdown
      .populate("employeeBreakdown.employee")
      .populate("reviewedBy", "firstName lastName")
      // 🔥 FULL SUBTASK POPULATE (IMPORTANT)
      .populate({
        path: "completedSubTasks.subTaskId",
        populate: [
          {
            path: "assignedTo",
            select: "firstName lastName email",
          },
          {
            path: "assignedBy",
            select: "firstName lastName",
          },
        ],
      })

      .lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: report,
    });

  } catch (err) {
    console.error("Get report details error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching report",
    });
  }
};

exports.updateWorkReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { subTaskId, afterWorkImagesdescription } = req.body;

    const report = await WorkReport.findById(reportId);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (!report.isEditable) {
      return res.status(400).json({
        message: "Report is locked after approval",
      });
    }

    // 🔥 find specific subtask inside report
    const subTask = report.completedSubTasks.find(
      (s) => s.subTaskId.toString() === subTaskId
    );

    if (!subTask) {
      return res.status(404).json({
        message: "SubTask not found in report",
      });
    }

    // ✅ update allowed fields only
    if (afterWorkImagesdescription !== undefined) {
      subTask.afterWorkImagesdescription = afterWorkImagesdescription;
    }

    await report.save();

    return res.json({
      success: true,
      message: "Report updated successfully",
      data: report,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update report" });
  }
};

const generateInvoice = async (contractId) => {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error("Contract not found");

  const reports = await WorkReport.find({
    contract: contractId,
    status: "approved",
    isBilled: false,
  });

  if (!reports.length) return;

  let totalAmount = 0;

  // ================= BILLING =================

  if (contract.billingType === "fixed") {
    const existing = await Invoice.findOne({
      contract: contractId,
      billingType: "fixed",
    });

    if (existing) return;

    totalAmount = contract.totalCost;
  }

  if (contract.billingType === "per_service") {
    totalAmount = reports.reduce((sum, r) => {
      return sum + r.completedSubTasks.reduce(
        (s, sub) => s + (sub.price || 0),
        0
      );
    }, 0);
  }

  if (contract.billingType === "hourly") {
    const totalHours = reports.reduce(
      (sum, r) => sum + (r.totalHours || 0),
      0
    );

    totalAmount = totalHours * (contract.hourlyRate || 0);
  }

  // ================= CREATE DRAFT INVOICE =================

  const invoice = await Invoice.create({
    contract: contractId,
    client: contract.client,
    company: contract.company,
    amount: totalAmount,
    billingType: contract.billingType,
    status: "draft", // ✅ IMPORTANT
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
    invoiceNumber: contract.invoiceNumber
  });

  // ================= MARK REPORTS =================

  await WorkReport.updateMany(
    { _id: { $in: reports.map(r => r._id) } },
    { isBilled: true }
  );

  return invoice;
};

const updateEmployeeSalary = async (employeeId, amount, data, employee) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const config = employee.employeeProfile?.employeePayment || {};
  const deductions = config.deductions || {};
  const bonus = config.bonus || 0;

  // 🔥 Deduction calc
  const pf = (amount * (deductions.pf || 0)) / 100;
  const esi = (amount * (deductions.esi || 0)) / 100;
  const tax = (amount * (deductions.tax || 0)) / 100;
  const other = deductions.other || 0;

  const totalDeduction = pf + esi + tax + other;

  const net = amount + bonus - totalDeduction;

  await EmployeeSalary.findOneAndUpdate(
    { employee: employeeId, month, year },
    {
      $inc: {
        grossAmount: amount,
        totalTasks: data.totalTasks,
        totalTimeSeconds: data.totalTime,
        deduction: totalDeduction,
        netSalary: net,

        "deductionBreakdown.pf": pf,
        "deductionBreakdown.esi": esi,
        "deductionBreakdown.tax": tax,
        "deductionBreakdown.other": other,
      },
      $setOnInsert: {
        company: employee.company,
        bonus,
        status: "pending",
      },
    },
    { upsert: true, new: true }
  );
};

const getWorkedDays = async (employeeId, reportId) => {
  const report = await WorkReport.findById(reportId);

  if (!report) return 0;

  const subTaskIds = report.completedSubTasks.map(
    (s) => new mongoose.Types.ObjectId(s.subTaskId)
  );

  if (!subTaskIds.length) return 0;

  const result = await SubTask.aggregate([
    {
      $match: {
        _id: { $in: subTaskIds },
        assignedTo: new mongoose.Types.ObjectId(employeeId), // ✅ FIXED
        status: "completed",
      },
    },
    {
      $project: {
        day: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$updatedAt",
            timezone: "Asia/Kolkata",
          },
        },
      },
    },
    {
      $group: {
        _id: "$day",
      },
    },
    {
      $count: "totalDays",
    },
  ]);

  return result[0]?.totalDays || 0;
};

const generateEmployeePayments = async (contractId, reportId) => {

  const reports = await WorkReport.find({
    _id: reportId,
    contract: contractId,
    status: "approved",
    isBilled: false,
  });

  if (!reports.length) return;

  const employeeMap = {};

  // 🔥 Aggregate employee data
  for (const report of reports) {
    const breakdown = report.employeeBreakdown || [];

    for (const emp of breakdown) {
      const id = emp.employee.toString();

      if (!employeeMap[id]) {
        employeeMap[id] = {
          totalTime: 0,
          totalTasks: 0,
          totalAmount: 0,
        };
      }

      employeeMap[id].totalTime += emp.totalTimeSeconds || 0;
      employeeMap[id].totalTasks += emp.totalTasks || 0;
      employeeMap[id].totalAmount += emp.totalAmount || 0;
    }
  }

  // 🔥 Process each employee
  for (const empId in employeeMap) {
    const data = employeeMap[empId];

    const employee = await User.findById(empId);
    if (!employee) continue;

    const paymentConfig =
      employee.employeeProfile?.employeePayment || {};

    const type = paymentConfig.paymentType || "hourly";

    let amount = 0;

    // 🔥 prevent duplicate
    const alreadyExists = await EmployeePayment.findOne({
      employee: empId,
      contract: contractId,
      report: reportId,
      paymentType: type,
    });

    if (alreadyExists) continue;

    // ================= CALCULATION =================

    if (type === "hourly") {
      amount =
        (data.totalTime / 3600) *
        (paymentConfig.hourlyRate || 0);

    } else if (type === "per_service") {
      amount =
        (data.totalTasks || 0) *
        (paymentConfig.perServiceRate || 0);

    } else if (type === "fixed") {

      const now = new Date();

      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();

      const perDaySalary =
        (paymentConfig.fixedSalary || 0) / daysInMonth;

      // ✅ get real worked days
      const workedDays = await getWorkedDays(empId, reportId);
      amount = perDaySalary * workedDays;
    }

    // ================= SAVE =================

    await EmployeePayment.create({
      employee: empId,
      contract: contractId,
      report: reportId,
      company: employee.company,
      totalTimeSeconds: data.totalTime,
      totalTasks: data.totalTasks,
      amount,
      paymentType: type,
    });

    // 🔥 update salary
    await updateEmployeeSalary(empId, amount, data, employee);
  }
};


exports.approveWorkReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await WorkReport.findById(reportId);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (report.status === "approved") {
      return res.status(400).json({ message: "Already approved" });
    }

    // ✅ APPROVE
    report.status = "approved";
    report.isEditable = false; // 🔥 lock
    report.approvedBy = req.user._id;
    report.approvedAt = new Date();

    await report.save();


    // 🔥 PAYROLL (OK to auto)
    await generateEmployeePayments(report.contract, report._id);

    // 🔥 CREATE DRAFT INVOICE ONLY
    const invoice = await generateInvoice(report.contract);

    return res.json({
      success: true,
      message: "Report approved & draft invoice created",
      invoiceId: invoice?._id || null,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error approving report" });
  }
};

exports.generateFixedSalary = async () => {
  const now = new Date();

  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const employees = await User.find({
    "employeeProfile.employeePayment.paymentType": "fixed",
  });

  for (const employee of employees) {
    const empId = employee._id;

    const config =
      employee.employeeProfile?.employeePayment || {};

    const fixedSalary = config.fixedSalary || 0;

    // ❌ prevent duplicate monthly salary
    const alreadyPaid = await EmployeePayment.findOne({
      employee: empId,
      paymentType: "fixed",
      createdAt: { $gte: startOfMonth },
    });

    if (alreadyPaid) continue;

    // ✅ create salary payment
    await EmployeePayment.create({
      employee: empId,
      company: employee.company,
      amount: fixedSalary,
      paymentType: "fixed",
    });

    // ✅ update salary summary
    await updateEmployeeSalary(
      empId,
      fixedSalary,
      { totalTasks: 0, totalTime: 0 },
      employee
    );
  }
};

exports.sendInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId)
      .populate({
        path: "contract",
        populate: {
          path: "property",
        },
      })
      .populate("client")
      .populate("company");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status !== "draft") {
      return res.status(400).json({
        message: "Invoice already sent",
      });
    }

    const reports = await WorkReport.find({
      contract: invoice.contract._id,
      status: "approved",
    });

    const subTaskIds = reports.flatMap(r =>
      r.completedSubTasks.map(s => s.subTaskId)
    );

    const subTasks = await SubTask.find({
      _id: { $in: subTaskIds },
    });

    const html = buildInvoiceEmail({
      contract: invoice.contract,
      property: invoice.contract.property,
      client: invoice.client,
      reports,
      subTasks,
      invoice,
    });

    await sendSimpleMail({
      to: invoice.client.email,
      subject: `Invoice - ${invoice.contract.contractNumber}`,
      html,
    });

    // ✅ UPDATE STATUS
    invoice.status = "sent";
    invoice.sentAt = new Date();
    await invoice.save();

    return res.json({
      success: true,
      message: "Invoice sent successfully",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sending invoice" });
  }
};

exports.getAllInvoices = async (req, res) => {
  try {
    // ================= PAGINATION =================
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const { status, clientId, contractId } = req.query;

    const query = {};

    // ================= ROLE-BASED FILTER =================
    if (req.user?.role?.name !== "superAdmin") {
      query.company = req.user.company;
    }

    // ================= STATUS VALIDATION =================
    const allowedStatus = [
      "draft",
      "sent",
      "partially_paid",
      "paid",
      "overdue",
    ];

    if (status) {
      const statusArray = status.split(",");
      const invalidStatus = statusArray.find(
        (s) => !allowedStatus.includes(s)
      );

      if (invalidStatus) {
        return res.status(400).json({
          message: `Invalid status: ${invalidStatus}`,
        });
      }

      query.status = { $in: statusArray };
    }

    // ================= OBJECT ID VALIDATION =================
    if (clientId) {
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(400).json({
          message: "Invalid clientId",
        });
      }
      query.client = clientId;
    }

    if (contractId) {
      if (!mongoose.Types.ObjectId.isValid(contractId)) {
        return res.status(400).json({
          message: "Invalid contractId",
        });
      }
      query.contract = contractId;
    }

    // ================= FETCH DATA =================
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate("client", "name email")
        .populate("contract", "contractNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Invoice.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error fetching invoices",
    });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({
        message: "Invalid invoiceId",
      });
    }

    const query = { _id: invoiceId };

    if (req.user?.role?.name !== "superAdmin") {
      query.company = req.user.company;
    }

    const invoice = await Invoice.findOne(query)
      .populate("client", "name email phone address")
      .populate("contract", "contractNumber startDate endDate")
      .populate("company", "name email")

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    return res.json({
      success: true,
      data: invoice,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error fetching invoice details",
    });
  }
};

exports.payInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { amount, method, referenceId, notes } = req.body;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({
        message: "Invoice already fully paid",
      });
    }

    // 🔥 validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid payment amount",
      });
    }

    if (amount > invoice.remainingAmount) {
      return res.status(400).json({
        message: "Amount exceeds remaining balance",
      });
    }

    // ================= CREATE PAYMENT =================

    await Payment.create({
      invoice: invoice._id,
      client: invoice.client,
      company: invoice.company,
      amount,
      method,
      referenceId,
      notes,
    });

    // ================= UPDATE INVOICE =================

    invoice.paidAmount += amount;

    // 🔥 status handled by pre-save hook
    await invoice.save();

    return res.json({
      success: true,
      message: "Payment recorded successfully",
      data: {
        paidAmount: invoice.paidAmount,
        remainingAmount: invoice.remainingAmount,
        status: invoice.status,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment failed" });
  }
};


exports.getInvoicePayments = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const payments = await Payment.find({
      invoice: invoiceId,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: payments,
    });

  } catch (err) {
    res.status(500).json({ message: "Error fetching payments" });
  }
};