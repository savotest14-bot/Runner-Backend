const fs = require("fs");
const path = require("path");
const { createCompanyAndAdmin } = require("../services/company.service");
const Company = require("../models/company");
const mongoose = require("mongoose");
const User = require("../models/user");
const { deleteFileIfExists } = require("../functions/common");

const Task = require("../models/task");
const Client = require("../models/client");
const Property = require("../models/property");
const Role = require("../models/role");
const { generateRandomPassword } = require("../functions/password");
const Invoice = require("../models/Invoice");
const Contract = require("../models/contract")
const SubTask = require("../models/subtask");
const EmployeePayment = require("../models/EmployeePayment");
const Group = require("../models/group")

// exports.adminCreateCompany = async (req, res) => {
//   try {
//     const files = req.files || [];
//     const licenseDocuments = files.map((file) => ({
//       fileName: file.originalname,
//       fileUrl: `/uploads/licenses/${file.filename}`,
//     }));

//     const {
//       companyName,
//       contactEmail,
//       phoneNumber,
//       adminPassword,
//       licenseNo,
//       licenseExpiryDate,
//       firstName,
//       lastName,
//       addressLine1,
//       addressLine2,
//       city,
//       state,
//       country,
//       pincode,
//     } = req.body;

//     if (!companyName || !contactEmail || !phoneNumber || !adminPassword) {
//       return res.status(400).json({
//         message: "Missing required fields",
//       });
//     }

//     const address = {
//       addressLine1,
//       addressLine2,
//       city,
//       state,
//       country,
//       pincode,
//     };

//     const isApproved = "approved";
//     const { company, companyAdmin } = await createCompanyAndAdmin({
//       companyData: {
//         companyName,
//         contactEmail,
//         phoneNumber,
//         licenseNo,
//         licenseExpiryDate,
//         address,
//         licenseDocuments,
//         isApproved,
//       },
//       adminData: {
//         email: contactEmail,
//         phone: phoneNumber,
//         password: adminPassword,
//         isApproved,
//         firstName,
//         lastName,
//       },
//       createdByUserId: req.user._id,
//     });

//     return res.status(201).json({
//       message: "Company and Company Admin created successfully",
//       companyId: company._id,
//       adminId: companyAdmin._id,
//     });
//   } catch (err) {
//     if (req.files?.length) {
//       req.files.forEach((file) => {
//         fs.unlink(path.join("uploads/licenses", file.filename), () => { });
//       });
//     }

//     return res.status(400).json({
//       message: err.message,
//     });
//   }
// };


exports.adminCreateCompany = async (req, res) => {
  try {
    const files = req.files || {};

    // ✅ License documents (multiple)
    const licenseFiles = files.licenseDocuments || [];
    const licenseDocuments = licenseFiles.map((file) => ({
      fileName: file.originalname,
      fileUrl: `/uploads/licenses/${file.filename}`,
    }));

    // ✅ Company logo (single)
    const logoFile = files.companyLogo?.[0] || null;
    const companyLogo = logoFile
      ? `/uploads/company-logos/${logoFile.filename}`
      : null;

    const {
      companyName,
      contactEmail,
      phoneNumber,
      adminPassword,
      licenseNo,
      licenseExpiryDate,
      firstName,
      lastName,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      pincode,
    } = req.body;

    if (!companyName || !contactEmail || !phoneNumber || !adminPassword) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    const address = {
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      pincode,
    };

    const isApproved = "approved";

    const { company, companyAdmin } = await createCompanyAndAdmin({
      companyData: {
        companyName,
        contactEmail,
        phoneNumber,
        licenseNo,
        licenseExpiryDate,
        address,
        licenseDocuments,
        logo: companyLogo, // ✅ ADDED
        isApproved,
      },
      adminData: {
        email: contactEmail,
        phone: phoneNumber,
        password: adminPassword,
        isApproved,
        firstName,
        lastName,
      },
      createdByUserId: req.user._id,
    });

    return res.status(201).json({
      message: "Company and Company Admin created successfully",
      companyId: company._id,
      adminId: companyAdmin._id,
    });

  } catch (err) {

    // ✅ Proper cleanup for both fields
    if (req.files) {
      Object.values(req.files).flat().forEach((file) => {
        const folder =
          file.fieldname === "companyLogo"
            ? "uploads/company-logos"
            : "uploads/licenses";

        fs.unlink(path.join(folder, file.filename), () => { });
      });
    }

    return res.status(400).json({
      message: err.message,
    });
  }
};

exports.getAllCompanies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const city = req.query.city || "";

    const skip = (page - 1) * limit;

    const matchStage = {
      isDeleted: false,
      ...(city && {
        "address.city": { $regex: city, $options: "i" },
      }),
      ...(search && {
        $or: [
          { companyName: { $regex: search, $options: "i" } },
          { contactEmail: { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
        ],
      }),
    };

    const pipeline = [
      { $match: matchStage },

      // ✅ Lookup Company Admin from users collection
      {
        $lookup: {
          from: "users",
          let: { companyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$company", "$$companyId"] },
                    { $eq: ["$isDeleted", false] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: "roles",
                localField: "role",
                foreignField: "_id",
                as: "roleData",
              },
            },
            { $unwind: "$roleData" },
            {
              $match: {
                "roleData.name": "company_admin",
              },
            },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
              },
            },
          ],
          as: "companyAdmin",
        },
      },

      {
        $unwind: {
          path: "$companyAdmin",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          _id: 0,
          companyId: "$_id",
          companyName: 1,
          contactEmail: 1,
          phoneNumber: 1,
          createdAt: 1,
          isApproved: 1,
          licenseExpiryDate: 1,
          licenseNo: 1,
          paymentFrequency: 1,
          subscriptionAmount: 1,
          subscriptionStatus: 1,
          address: 1,

          adminFirstName: "$companyAdmin.firstName",
          adminLastName: "$companyAdmin.lastName",
          adminEmail: "$companyAdmin.email",

          adminFullName: {
            $concat: [
              { $ifNull: ["$companyAdmin.firstName", ""] },
              " ",
              { $ifNull: ["$companyAdmin.lastName", ""] },
            ],
          },
        },
      },

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [companies, total] = await Promise.all([
      Company.aggregate(pipeline),
      Company.countDocuments(matchStage),
    ]);

    return res.status(200).json({
      success: true,
      data: companies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get companies error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
    });
  }
};

exports.searchCompanies = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";

    const matchStage = {
      isDeleted: false,
      ...(search && {
        companyName: { $regex: search, $options: "i" },
      }),
    };

    const companies = await Company.aggregate([
      { $match: matchStage },

      {
        $project: {
          _id: 0,
          companyId: "$_id",
          companyName: 1,
        },
      },

      { $sort: { companyName: 1 } }, // optional: alphabetical order
    ]);

    return res.status(200).json({
      success: true,
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    console.error("Search companies error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
    });
  }
};

exports.getPendingSubscriptionCompanies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const city = req.query.city || "";

    const skip = (page - 1) * limit;

    const matchStage = {
      isDeleted: false,
      isApproved: "pending",
      ...(city && {
        "address.city": { $regex: city, $options: "i" },
      }),
      ...(search && {
        $or: [
          { companyName: { $regex: search, $options: "i" } },
          { contactEmail: { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
        ],
      }),
    };

    const pipeline = [
      { $match: matchStage },

      {
        $lookup: {
          from: "users",
          let: { companyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$company", "$$companyId"] },
                    { $eq: ["$isDeleted", false] },
                  ],
                },
              },
            },

            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
              },
            },
          ],
          as: "companyAdmin",
        },
      },

      {
        $unwind: {
          path: "$companyAdmin",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          _id: 0,
          companyId: "$_id",
          companyName: 1,
          contactEmail: 1,
          phoneNumber: 1,
          createdAt: 1,
          isApproved: 1,
          licenseExpiryDate: 1,
          licenseNo: 1,
          paymentFrequency: 1,
          subscriptionAmount: 1,
          subscriptionStatus: 1,
          address: 1,
          adminFirstName: "$companyAdmin.firstName",
          adminLastName: "$companyAdmin.lastName",
          adminEmail: "$companyAdmin.email",

          adminFullName: {
            $concat: [
              { $ifNull: ["$companyAdmin.firstName", ""] },
              " ",
              { $ifNull: ["$companyAdmin.lastName", ""] },
            ],
          },

        },
      },

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [companies, total] = await Promise.all([
      Company.aggregate(pipeline),
      Company.countDocuments(matchStage),
    ]);

    return res.status(200).json({
      success: true,
      data: companies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Pending companies error:", error);
    return res.status(500).json({
      message: "Failed to fetch pending companies",
    });
  }
};


exports.getActiveSubscriptionCompanies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const city = req.query.city || "";

    const skip = (page - 1) * limit;

    const matchStage = {
      isDeleted: false,
      isApproved: "approved",
      ...(city && {
        "address.city": { $regex: city, $options: "i" },
      }),
      ...(search && {
        $or: [
          { companyName: { $regex: search, $options: "i" } },
          { contactEmail: { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
        ],
      }),
    };

    const pipeline = [
      { $match: matchStage },

      {
        $lookup: {
          from: "users",
          let: { companyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$company", "$$companyId"] },
                    { $eq: ["$isDeleted", false] },
                  ],
                },
              },
            },
            { $limit: 1 }, // ✅ prevent duplicates
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
              },
            },
          ],
          as: "companyAdmin",
        },
      },

      {
        $addFields: {
          companyAdmin: { $arrayElemAt: ["$companyAdmin", 0] },
        },
      },

      {
        $project: {
          _id: 0,
          companyId: "$_id",
          companyName: 1,
          contactEmail: 1,
          phoneNumber: 1,
          createdAt: 1,
          isApproved: 1,
          licenseExpiryDate: 1,
          licenseNo: 1,
          paymentFrequency: 1,
          subscriptionAmount: 1,
          subscriptionStatus: 1,
          address: 1,

          adminFirstName: "$companyAdmin.firstName",
          adminLastName: "$companyAdmin.lastName",
          adminEmail: "$companyAdmin.email",

          adminFullName: {
            $concat: [
              { $ifNull: ["$companyAdmin.firstName", ""] },
              " ",
              { $ifNull: ["$companyAdmin.lastName", ""] },
            ],
          },
        },
      },

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [companies, total] = await Promise.all([
      Company.aggregate(pipeline),
      Company.countDocuments(matchStage),
    ]);

    return res.status(200).json({
      success: true,
      data: companies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Active subscription companies error:", error);
    return res.status(500).json({
      message: "Failed to fetch active companies",
    });
  }
};


exports.updateCompanyStatus = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { isApproved } = req.body;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid company id" });
    }

    const APPROVAL_STATUS = ["pending", "approved", "rejected", "banned"];
    if (!APPROVAL_STATUS.includes(isApproved)) {
      return res.status(400).json({
        message: `Invalid isApproved value. Allowed values: ${APPROVAL_STATUS.join(", ")}`,
      });
    }

    const company = await Company.findOneAndUpdate(
      { _id: companyId, isDeleted: false },
      { $set: { isApproved } },
      { new: true },
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const companyAdmin = await User.findOne({
      company: companyId,
      isDeleted: false,
    }).populate("role");

    if (companyAdmin && companyAdmin.role.name === "company_admin") {
      await User.findByIdAndUpdate(companyAdmin._id, {
        $set: { isApproved },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Company and company admin status updated successfully",
      data: {
        companyId: company._id,
        isApproved: company.isApproved,
      },
    });
  } catch (error) {
    console.error("Update company status error:", error);
    return res.status(500).json({
      message: "Failed to update company status",
    });
  }
};


exports.getCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        message: "Invalid company id",
      });
    }

    // ================= COMPANY =================
    const company = await Company.findOne({
      _id: companyId,
      isDeleted: false,
    })
      .populate("planId", "planName monthlyFee annualFee")
      .populate("createdBy", "firstName lastName email")
      .lean();

    if (!company) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    // ================= STATS =================

    const totalEmployees = await User.countDocuments({
      company: companyId,
      isDeleted: false,
    });
    const totalSubTasks = await SubTask.countDocuments({
      company: companyId,
    });
    const totalTasks = await Task.countDocuments({
      company: companyId,
    });

    const totalContracts = await Contract.countDocuments({
      company: companyId,
    });

    const totalInvoicesAgg = await Invoice.aggregate([
      {
        $match: { company: new mongoose.Types.ObjectId(companyId) },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalEarning = totalInvoicesAgg[0]?.total || 0;

    const totalPaidAgg = await Invoice.aggregate([
      {
        $match: {
          company: new mongoose.Types.ObjectId(companyId),
          status: "paid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$paidAmount" },
        },
      },
    ]);

    const netProfit = totalPaidAgg[0]?.total || 0;

    // ================= DOCUMENT URL FIX =================

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    if (company.licenseDocuments?.length) {
      company.licenseDocuments = company.licenseDocuments.map((doc) => ({
        ...doc,
        fileUrl: `${baseUrl}${doc.fileUrl}`,
      }));
    }

    // ================= RESPONSE =================

    return res.status(200).json({
      success: true,
      data: {
        cards: {
          totalEarning,
          totalTasks,
          totalSubTasks,
          totalEmployees,
          totalContracts,
          netProfit,
        },
        subscription: {
          plan: company.planId?.planName,
          monthlyFee: company.planId?.monthlyFee,
          annualFee: company.planId?.annualFee,
          status: company.subscriptionStatus,
          startDate: company.subscriptionStartDate,
          renewalDate: company.subscriptionEndDate,
        },

        documents: company.licenseDocuments || [],

        createdBy: company.createdBy,
        company: company
      },
    });

  } catch (error) {
    console.error("Get company by id error:", error);
    return res.status(500).json({
      message: "Failed to fetch company",
    });
  }
};

exports.updateCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid company id" });
    }

    /* ---------------- FETCH COMPANY ---------------- */
    const existingCompany = await Company.findOne({
      _id: companyId,
      isDeleted: false,
    });

    if (!existingCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    /* ---------------- FILES ---------------- */
    const files = req.files || [];

    const newLicenseDocuments = files.map((file) => ({
      fileName: file.originalname,
      fileUrl: `/uploads/licenses/${file.filename}`,
      uploadedAt: new Date(),
    }));

    /* ---------------- BODY ---------------- */
    const {
      companyName,
      contactEmail,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      pincode,
      licenseNo,
      licenseExpiryDate,
    } = req.body;

    const updateData = {};

    /* ---------------- UNIQUE CHECKS ---------------- */
    if (contactEmail && contactEmail !== existingCompany.contactEmail) {
      const emailExists = await Company.findOne({
        contactEmail: contactEmail.toLowerCase(),
        _id: { $ne: companyId },
        isDeleted: false,
      });

      if (emailExists) {
        return res.status(409).json({
          message: "Contact email already in use by another company",
        });
      }

      updateData.contactEmail = contactEmail.toLowerCase();
    }

    if (phoneNumber && phoneNumber !== existingCompany.phoneNumber) {
      const phoneExists = await Company.findOne({
        phoneNumber,
        _id: { $ne: companyId },
        isDeleted: false,
      });

      if (phoneExists) {
        return res.status(409).json({
          message: "Phone number already in use by another company",
        });
      }

      updateData.phoneNumber = phoneNumber;
    }

    if (companyName) updateData.companyName = companyName;

    /* ---------------- LICENSES ---------------- */
    if (licenseNo) {
      updateData.licenseNo = licenseNo;
    }
    if (licenseExpiryDate) {
      updateData.licenseExpiryDate = licenseExpiryDate;
    }

    /* ---------------- ADDRESS ---------------- */
    if (addressLine1 || addressLine2 || city || state || country || pincode) {
      updateData.address = {
        ...existingCompany.address?.toObject(),
        ...(addressLine1 && { addressLine1 }),
        ...(addressLine2 && { addressLine2 }),
        ...(city && { city }),
        ...(state && { state }),
        ...(country && { country }),
        ...(pincode && { pincode }),
      };
    }

    /* ---------------- REPLACE LICENSE DOCS ---------------- */
    if (newLicenseDocuments.length) {
      existingCompany.licenseDocuments.forEach((doc) => {
        const filePath = path.join(process.cwd(), doc.fileUrl);
        fs.existsSync(filePath) && fs.unlinkSync(filePath);
      });

      updateData.licenseDocuments = newLicenseDocuments;
    }

    if (!Object.keys(updateData).length) {
      return res.status(400).json({
        message: "No valid fields or files provided to update",
      });
    }

    /* ---------------- UPDATE COMPANY ---------------- */
    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      { $set: updateData },
      { new: true },
    )
      .populate("planId", "planName monthlyFee annualFee")
      .populate("createdBy", "firstName lastName email")
      .lean();

    /* ---------------- BASE URL ---------------- */
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    if (updatedCompany.licenseDocuments?.length) {
      updatedCompany.licenseDocuments = updatedCompany.licenseDocuments.map(
        (doc) => ({
          ...doc,
          fileUrl: `${baseUrl}${doc.fileUrl}`,
        }),
      );
    }

    return res.status(200).json({
      message: "Company updated successfully",
      data: updatedCompany,
    });
  } catch (error) {
    console.error("Update company error:", error);

    /* ---------------- CLEANUP NEW FILES ON ERROR ---------------- */
    if (req.files?.length) {
      req.files.forEach((file) => {
        fs.unlink(path.join("uploads/licenses", file.filename), () => { });
      });
    }

    return res.status(500).json({
      message: "Failed to update company",
    });
  }
};

exports.getAllEmployeesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 10, search = "" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid companyId" });
    }

    if (req.user.company && req.user.company.toString() !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const searchFilter = search
      ? {
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }
      : {};

    const filter = {
      company: companyId,
      isDeleted: false,
      employeeProfile: { $ne: null },
      ...searchFilter,
    };

    const [employees, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .populate("company", "companyName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "Employees fetched successfully",
      data: employees,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get employees error:", error);
    return res.status(500).json({
      message: "Failed to fetch employees",
    });
  }
};

exports.getAllEmployeesforAssign = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid companyId" });
    }
    const filter = {
      company: companyId,
      isDeleted: false,
      employeeProfile: { $ne: null },
    };

    const employees = await User.find(filter)
      .select("_id firstName lastName")
      .sort({ firstName: 1 })
      .lean();

    const formattedEmployees = employees.map(emp => ({
      employeeId: emp._id,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
    }));

    return res.status(200).json({
      message: "Employees fetched successfully",
      data: formattedEmployees,
    });
  } catch (error) {
    console.error("Get employees error:", error);
    return res.status(500).json({
      message: "Failed to fetch employees",
    });
  }
};

exports.getAllCompanyAdmins = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { search = "", city = "", page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const matchStage = {
      isDeleted: false,
    };

    const pipeline = [
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: "$role" },

      {
        $match: {
          "role.name": "company_admin",
          ...matchStage,
        },
      },

      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $match: {
          ...(search && {
            "company.companyName": {
              $regex: search,
              $options: "i",
            },
          }),
          ...(city && {
            "address.city": {
              $regex: city,
              $options: "i",
            },
          }),
        },
      },

      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: Number(skip) },
            { $limit: Number(limit) },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                profilePic: 1,
                isApproved: 1,
                createdAt: 1,
                "company.companyName": 1,
                "address.city": 1,
              },
            },
          ],

          counts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                pending: {
                  $sum: {
                    $cond: [{ $eq: ["$isApproved", "pending"] }, 1, 0],
                  },
                },
                approved: {
                  $sum: {
                    $cond: [{ $eq: ["$isApproved", "approved"] }, 1, 0],
                  },
                },
                rejected: {
                  $sum: {
                    $cond: [{ $eq: ["$isApproved", "rejected"] }, 1, 0],
                  },
                },
                banned: {
                  $sum: {
                    $cond: [{ $eq: ["$isApproved", "banned"] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ];

    const result = await User.aggregate(pipeline);

    const data = result[0]?.data || [];
    const counts = result[0]?.counts[0] || {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      banned: 0,
    };

    return res.status(200).json({
      success: true,
      data,
      stats: {
        total: counts.total,
        pending: counts.pending,
        approved: counts.approved,
        rejected: counts.rejected,
        banned: counts.banned,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Get company admins error:", error);
    return res.status(500).json({
      message: "Failed to fetch company admins",
    });
  }
};

exports.getPendingCompanyAdmins = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { search = "", city = "", page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: "$role" },

      {
        $match: {
          isDeleted: false,
          "role.name": "company_admin",
          isApproved: "pending",
        },
      },

      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $match: {
          ...(search && {
            "company.companyName": { $regex: search, $options: "i" },
          }),
          ...(city && {
            "address.city": { $regex: city, $options: "i" },
          }),
        },
      },

      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: Number(skip) },
            { $limit: Number(limit) },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                profilePic: 1,
                isApproved: 1,
                createdAt: 1,
                "company.companyName": 1,
                "address.city": 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await User.aggregate(pipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
      },
    });
  } catch (error) {
    console.error("Pending company admins error:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch pending company admins" });
  }
};

exports.getApprovedCompanyAdmins = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { search = "", city = "", page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: "$role" },

      {
        $match: {
          isDeleted: false,
          "role.name": "company_admin",
          isApproved: "approved",
        },
      },

      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $match: {
          ...(search && {
            "company.companyName": { $regex: search, $options: "i" },
          }),
          ...(city && {
            "address.city": { $regex: city, $options: "i" },
          }),
        },
      },

      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: Number(skip) },
            { $limit: Number(limit) },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                profilePic: 1,
                isApproved: 1,
                createdAt: 1,
                "company.companyName": 1,
                "address.city": 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await User.aggregate(pipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
      },
    });
  } catch (error) {
    console.error("Approved company admins error:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch approved company admins" });
  }
};

exports.getSingleCompanyAdmin = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const companyAdmin = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
          isDeleted: false,
        },
      },

      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: "$role" },

      {
        $match: {
          "role.name": "company_admin",
        },
      },
      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          profilePic: 1,
          isApproved: 1,
          createdAt: 1,
          address: 1,
          "company._id": 1,
          "company.companyName": 1,
          "company.address": 1,
        },
      },
    ]);

    if (!companyAdmin.length) {
      return res.status(404).json({
        message: "Company admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: companyAdmin[0],
    });
  } catch (error) {
    console.error("Get single company admin error:", error);
    return res.status(500).json({
      message: "Failed to fetch company admin",
    });
  }
};

exports.updateCompanyAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const { email, phone, gender, isApproved } = req.body;

    const updateData = {};

    if (email) {
      const emailExists = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: id },
        isDeleted: false,
      });

      if (emailExists) {
        return res.status(409).json({
          message: "Email is already in use by another user",
        });
      }

      updateData.email = email.toLowerCase().trim();
    }

    if (phone) {
      const phoneExists = await User.findOne({
        phone,
        _id: { $ne: id },
        isDeleted: false,
      });

      if (phoneExists) {
        return res.status(409).json({
          message: "Phone number is already in use by another user",
        });
      }

      updateData.phone = phone;
    }

    const GENDERS = ["male", "female", "other"];
    if (gender !== undefined) {
      if (!GENDERS.includes(gender)) {
        return res.status(400).json({
          message: `Invalid gender value. Allowed values: ${GENDERS.join(", ")}`,
        });
      }

      updateData.gender = gender;
    }

    const APPROVAL_STATUS = ["pending", "approved", "rejected", "banned"];
    if (isApproved !== undefined) {
      if (!APPROVAL_STATUS.includes(isApproved)) {
        return res.status(400).json({
          message: `Invalid isApproved value. Allowed values: ${APPROVAL_STATUS.join(", ")}`,
        });
      }
      updateData.isApproved = isApproved;
    }

    const companyAdmin = await User.findOne({
      _id: id,
      isDeleted: false,
    }).populate("role");

    if (!companyAdmin || companyAdmin.role.name !== "company_admin") {
      return res.status(404).json({
        message: "Company admin not found",
      });
    }

    delete updateData.password;
    delete updateData.role;
    delete updateData.isDeleted;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    )
      .select("-password")
      .populate("role", "name");

    if (isApproved !== undefined && companyAdmin.company) {
      await Company.findByIdAndUpdate(
        companyAdmin.company,
        { $set: { isApproved } },
      );
    }

    return res.status(200).json({
      success: true,
      message: "Company admin updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update company admin error:", error);
    return res.status(500).json({
      message: "Failed to update company admin",
    });
  }
};

exports.updateCompanyAdminProfilePic = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Profile image is required",
      });
    }

    const companyAdmin = await User.findOne({
      _id: id,
      isDeleted: false,
    }).populate("role");

    if (!companyAdmin || companyAdmin.role.name !== "company_admin") {
      return res.status(404).json({
        message: "Company admin not found",
      });
    }

    if (companyAdmin.profilePic) {
      deleteFileIfExists(companyAdmin.profilePic);
    }

    const profilePic = req.file.path || req.file.location || req.file.url;

    companyAdmin.profilePic = profilePic;
    await companyAdmin.save();

    return res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePic,
    });
  } catch (error) {
    console.error("Update profile picture error:", error);
    return res.status(500).json({
      message: "Failed to update profile picture",
    });
  }
};

exports.toggleCompanyAndAllUsers = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid company admin id" });
    }

    const companyAdmin = await User.findOne({
      _id: id,
      isDeleted: { $in: [true, false] },
    }).populate("role");

    if (!companyAdmin || companyAdmin.role.name !== "company_admin") {
      return res.status(404).json({
        message: "Company admin not found",
      });
    }

    if (!companyAdmin.company) {
      return res.status(400).json({
        message: "Company admin is not linked to a company",
      });
    }

    const companyId = companyAdmin.company;

    const newIsDeleted = !companyAdmin.isDeleted;

    await Promise.all([
      Company.updateOne(
        { _id: companyId },
        { $set: { isDeleted: newIsDeleted } },
      ),

      User.updateMany(
        {
          company: companyId,
        },
        { $set: { isDeleted: newIsDeleted } },
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: newIsDeleted
        ? "Company and all related users deleted successfully"
        : "Company and all related users restored successfully",
      isDeleted: newIsDeleted,
    });
  } catch (error) {
    console.error("Toggle company users error:", error);
    return res.status(500).json({
      message: "Failed to toggle company and users",
    });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        message: "Invalid employee id",
      });
    }

    const employee = await User.findOne({
      _id: employeeId,
      isDeleted: false,
      employeeProfile: { $ne: null },
    })
      .select(
        "-password"
      )
      .populate("role", "name")
      .populate("company", "companyName")
      .lean();

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    if (employee.employeeProfile?.profileImage?.fileUrl) {
      employee.employeeProfile.profileImage.fileUrl =
        baseUrl + employee.employeeProfile.profileImage.fileUrl;
    }

    if (employee.employeeProfile?.documents?.idImages?.length) {
      employee.employeeProfile.documents.idImages =
        employee.employeeProfile.documents.idImages.map((doc) => ({
          ...doc,
          fileUrl: baseUrl + doc.fileUrl,
        }));
    }

    if (employee.employeeProfile?.documents?.aadhaarImages?.length) {
      employee.employeeProfile.documents.aadhaarImages =
        employee.employeeProfile.documents.aadhaarImages.map((doc) => ({
          ...doc,
          fileUrl: baseUrl + doc.fileUrl,
        }));
    }

    return res.status(200).json({
      message: "Employee fetched successfully",
      data: employee,
    });
  } catch (error) {
    console.error("Get employee by id error:", error);
    return res.status(500).json({
      message: "Failed to fetch employee",
    });
  }
};
exports.getAllUsersForSuperAdmin = async (req, res) => {
  try {
    // 🔐 Authorization
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { role, isApproved, search = "" } = req.query;

    const pipeline = [
      /* ❌ Exclude deleted users */
      {
        $match: { isDeleted: false },
      },

      /* 🔗 Join roles */
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: "$role" },

      /* 🔎 Filters */
      {
        $match: {
          ...(role && { "role.name": role }),
          ...(isApproved && { isApproved }),
          ...(search && {
            $or: [
              { firstName: { $regex: search, $options: "i" } },
              { lastName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { phone: { $regex: search, $options: "i" } },
            ],
          }),
        },
      },

      /* 🔗 Join company */
      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* 📊 Pagination + Count */
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },

            {
              $project: {
                _id: 0,
                userId: "$_id",

                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                profilePic: 1,
                gender: 1,
                isApproved: 1,
                createdAt: 1,

                role: "$role.name",

                company: {
                  companyId: "$company._id",
                  companyName: "$company.companyName",
                },
              },
            },
          ],

          totalCount: [{ $count: "total" }],
        },
      },
    ];

    const result = await User.aggregate(pipeline);

    const users = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({
      message: "Failed to fetch users",
    });
  }
};

exports.getAllTasksForSuperAdmin = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { status, companyId, search = "" } = req.query;

    const pipeline = [
      {
        $match: {
          isDeleted: false,
          ...(status && { status }),
          ...(companyId &&
            mongoose.Types.ObjectId.isValid(companyId) && {
            company: new mongoose.Types.ObjectId(companyId),
          }),
        },
      },

      {
        $match: {
          ...(search && {
            $or: [
              { taskName: { $regex: search, $options: "i" } },
              { taskCategory: { $regex: search, $options: "i" } },
              { taskSubCategory: { $regex: search, $options: "i" } },
            ],
          }),
        },
      },

      // ✅ COMPANY
      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: "$company" },

      // ✅ ASSIGNED BY
      {
        $lookup: {
          from: "users",
          localField: "assignedBy",
          foreignField: "_id",
          as: "assignedBy",
        },
      },
      {
        $unwind: {
          path: "$assignedBy",
          preserveNullAndEmptyArrays: true,
        },
      },

      // ✅ SUBTASKS JOIN (NEW)
      {
        $lookup: {
          from: "subtasks",
          localField: "subTasks",
          foreignField: "_id",
          as: "subTasks",
        },
      },

      // ✅ USERS FROM SUBTASKS
      {
        $lookup: {
          from: "users",
          localField: "subTasks.assignedTo",
          foreignField: "_id",
          as: "assignedUsers",
        },
      },

      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },

            {
              $project: {
                _id: 0,
                taskId: "$_id",

                taskName: 1,
                taskCategory: 1,
                taskSubCategory: 1,
                taskPrice: 1,
                status: 1,
                createdAt: 1,

                company: {
                  companyId: "$company._id",
                  companyName: "$company.companyName",
                },

                assignedBy: {
                  userId: "$assignedBy._id",
                  name: {
                    $concat: [
                      "$assignedBy.firstName",
                      " ",
                      "$assignedBy.lastName",
                    ],
                  },
                  email: "$assignedBy.email",
                },

                // ✅ SUBTASKS WITH USERS
                subTasks: {
                  $map: {
                    input: "$subTasks",
                    as: "sub",
                    in: {
                      subTaskId: "$$sub._id",
                      subTaskName: "$$sub.subTaskName",
                      status: "$$sub.status",
                      estimatedDurationSeconds:
                        "$$sub.estimatedDurationSeconds",

                      assignedTo: {
                        $filter: {
                          input: "$assignedUsers",
                          as: "user",
                          cond: {
                            $in: ["$$user._id", "$$sub.assignedTo"],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],

          totalCount: [{ $count: "total" }],
        },
      },
    ];

    const result = await Task.aggregate(pipeline);

    const tasks = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: tasks,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all tasks error:", error);
    return res.status(500).json({
      message: "Failed to fetch tasks",
    });
  }
};

// exports.getTaskByIdForSuperAdmin = async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ message: "Invalid task id" });
//     }

//     const employeeId = new mongoose.Types.ObjectId(req.user._id);
//     const userRole = req.user.role.name;

//     const pipeline = [
//       {
//         $match: {
//           _id: new mongoose.Types.ObjectId(id),
//           isDeleted: false,
//         },
//       },

//       // ✅ Company
//       {
//         $lookup: {
//           from: "companies",
//           localField: "company",
//           foreignField: "_id",
//           as: "company",
//         },
//       },
//       { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },

//       // ✅ Assigned By
//       {
//         $lookup: {
//           from: "users",
//           localField: "assignedBy",
//           foreignField: "_id",
//           as: "assignedBy",
//         },
//       },
//       { $unwind: { path: "$assignedBy", preserveNullAndEmptyArrays: true } },

//       // ✅ SubTasks
//       {
//         $lookup: {
//           from: "subtasks",
//           localField: "subTasks",
//           foreignField: "_id",
//           as: "subTasks",
//         },
//       },

//       // ✅ Sort SubTasks
//       {
//         $addFields: {
//           subTasks: {
//             $sortArray: {
//               input: "$subTasks",
//               sortBy: { createdAt: -1 },
//             },
//           },
//         },
//       },

//       // ✅ Role-based filtering
//       {
//         $addFields: {
//           subTasks: {
//             $cond: {
//               if: { $eq: [userRole, "employee"] },
//               then: {
//                 $filter: {
//                   input: "$subTasks",
//                   as: "sub",
//                   cond: {
//                     $in: [employeeId, "$$sub.assignedTo"],
//                   },
//                 },
//               },
//               else: "$subTasks",
//             },
//           },
//         },
//       },

//       // ✅ Hide task if no subtask for employee
//       ...(userRole === "employee"
//         ? [
//           {
//             $match: {
//               $expr: { $gt: [{ $size: "$subTasks" }, 0] },
//             },
//           },
//         ]
//         : []),

//       // ✅ Assigned Users
//       {
//         $lookup: {
//           from: "users",
//           localField: "subTasks.assignedTo",
//           foreignField: "_id",
//           as: "assignedUsers",
//         },
//       },

//       // ✅ Contract
//       {
//         $lookup: {
//           from: "contracts",
//           let: { taskId: "$_id" },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $in: ["$$taskId", "$tasks"] },
//                     { $eq: ["$isDeleted", false] },
//                   ],
//                 },
//               },
//             },
//           ],
//           as: "contract",
//         },
//       },
//       { $unwind: { path: "$contract", preserveNullAndEmptyArrays: true } },

//       // ✅ Property (via contract)
//       {
//         $lookup: {
//           from: "properties",
//           localField: "contract.property",
//           foreignField: "_id",
//           as: "property",
//         },
//       },
//       { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },

//       // ✅ Client (via property)
//       {
//         $lookup: {
//           from: "clients",
//           localField: "property.client",
//           foreignField: "_id",
//           as: "client",
//         },
//       },
//       { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },

//       // ✅ FINAL RESPONSE
//       {
//         $project: {
//           _id: 0,
//           taskId: "$_id",

//           // ✅ Task Details
//           taskDetails: {
//             taskId: "$_id",
//             taskName: "$taskName",
//             taskCategory: "$taskCategory",
//             taskSubCategory: "$taskSubCategory",
//             taskPrice: "$taskPrice",
//             taskDescription: "$taskDescription",
//             status: "$status",
//             createdAt: "$createdAt",
//             updatedAt: "$updatedAt",
//           },

//           // ✅ Company
//           company: {
//             companyId: "$company._id",
//             companyName: "$company.companyName",
//           },

//           // ✅ Contract
//           contract: {
//             contractId: "$contract._id",
//             contractNumber: "$contract.contractNumber",
//           },

//           // ✅ Property
//           property: {
//             propertyId: "$property._id",
//             propertyName: "$property.propertyName",
//             propertyType: "$property.propertyType",
//             address: "$property.location.address",
//             coordinates: "$property.location.coordinates",
//           },

//           // ✅ Client
//           client: {
//             clientId: "$client._id",
//             name: {
//               $concat: [
//                 { $ifNull: ["$client.firstName", ""] },
//                 " ",
//                 { $ifNull: ["$client.lastName", ""] },
//               ],
//             },
//             email: "$client.email",
//             contactNo: "$client.phoneNumber", // ⚠️ adjust if needed
//           },

//           // ✅ Assigned By
//           assignedBy: {
//             userId: "$assignedBy._id",
//             name: {
//               $concat: [
//                 { $ifNull: ["$assignedBy.firstName", ""] },
//                 " ",
//                 { $ifNull: ["$assignedBy.lastName", ""] },
//               ],
//             },
//             email: "$assignedBy.email",
//           },

//           // ✅ Full SubTask Details
//           subTasks: {
//             $map: {
//               input: "$subTasks",
//               as: "sub",
//               in: {
//                 $mergeObjects: [
//                   "$$sub",
//                   {
//                     assignedTo: {
//                       $map: {
//                         input: {
//                           $filter: {
//                             input: "$assignedUsers",
//                             as: "user",
//                             cond: {
//                               $in: ["$$user._id", "$$sub.assignedTo"],
//                             },
//                           },
//                         },
//                         as: "user",
//                         in: {
//                           userId: "$$user._id",
//                           name: {
//                             $concat: [
//                               "$$user.firstName",
//                               " ",
//                               "$$user.lastName",
//                             ],
//                           },
//                           email: "$$user.email",
//                         },
//                       },
//                     },
//                   },
//                 ],
//               },
//             },
//           },
//         },
//       },
//     ];

//     const task = await Task.aggregate(pipeline);

//     if (!task.length) {
//       return res.status(404).json({ message: "Task not found" });
//     }

//     return res.status(200).json({
//       success: true,
//       data: task[0],
//     });

//   } catch (error) {
//     console.error("Get task by id error:", error);
//     return res.status(500).json({
//       message: "Failed to fetch task",
//     });
//   }
// };


exports.getTaskByIdForSuperAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid task id" });
    }

    const user = req.user;
    const userId = new mongoose.Types.ObjectId(user._id);
    const userRole = user.role.name;

    // ================= BASE MATCH =================
    let matchStage = {
      _id: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    };

    // ✅ company_admin restriction
    if (userRole === "company_admin") {
      matchStage.company = new mongoose.Types.ObjectId(user.company);
    }

    // ================= CHECK GROUP ADMIN =================
    let isGroupAdmin = false;

    if (userRole === "employee") {
      const group = await Group.findOne({
        company: user.company,
        isDeleted: false,
        assignmentType: "TASK",
        task: id,
        "members.user": user._id,
        "members.role": "GROUP_ADMIN",
      });

      isGroupAdmin = !!group;
    }

    const pipeline = [
      { $match: matchStage },

      // ================= COMPANY =================
      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },

      // ================= ASSIGNED BY =================
      {
        $lookup: {
          from: "users",
          localField: "assignedBy",
          foreignField: "_id",
          as: "assignedBy",
        },
      },
      { $unwind: { path: "$assignedBy", preserveNullAndEmptyArrays: true } },

      // ================= SUBTASKS =================
      {
        $lookup: {
          from: "subtasks",
          localField: "subTasks",
          foreignField: "_id",
          as: "subTasks",
        },
      },

      {
        $addFields: {
          subTasks: {
            $sortArray: {
              input: "$subTasks",
              sortBy: { createdAt: -1 },
            },
          },
        },
      },

      // ================= ROLE-BASED SUBTASK FILTER =================
      {
        $addFields: {
          subTasks: {
            $cond: {
              if: {
                $and: [
                  { $eq: [userRole, "employee"] },
                  { $eq: [isGroupAdmin, false] }, // 👈 KEY LOGIC
                ],
              },
              then: {
                $filter: {
                  input: "$subTasks",
                  as: "sub",
                  cond: {
                    $in: [userId, "$$sub.assignedTo"],
                  },
                },
              },
              else: "$subTasks",
            },
          },
        },
      },

      // ================= BLOCK EMPTY TASK FOR EMPLOYEE =================
      ...(userRole === "employee" && !isGroupAdmin
        ? [
          {
            $match: {
              $expr: { $gt: [{ $size: "$subTasks" }, 0] },
            },
          },
        ]
        : []),

      // ================= ASSIGNED USERS =================
      {
        $lookup: {
          from: "users",
          localField: "subTasks.assignedTo",
          foreignField: "_id",
          as: "assignedUsers",
        },
      },

      // ================= CONTRACT =================
      {
        $lookup: {
          from: "contracts",
          let: { taskId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$$taskId", "$tasks"] },
                    { $eq: ["$isDeleted", false] },
                  ],
                },
              },
            },
          ],
          as: "contract",
        },
      },
      { $unwind: { path: "$contract", preserveNullAndEmptyArrays: true } },

      // ================= PROPERTY =================
      {
        $lookup: {
          from: "properties",
          localField: "contract.property",
          foreignField: "_id",
          as: "property",
        },
      },
      { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },

      // ================= CLIENT =================
      {
        $lookup: {
          from: "clients",
          localField: "property.client",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },

      // ================= FINAL RESPONSE =================
      {
        $project: {
          _id: 0,
          taskId: "$_id",

          taskDetails: {
            taskId: "$_id",
            taskName: "$taskName",
            taskCategory: "$taskCategory",
            taskSubCategory: "$taskSubCategory",
            taskPrice: "$taskPrice",
            taskDescription: "$taskDescription",
            status: "$status",
            createdAt: "$createdAt",
          },

          company: {
            companyId: "$company._id",
            companyName: "$company.companyName",
          },

          contract: {
            contractId: "$contract._id",
            contractNumber: "$contract.contractNumber",
          },

          property: {
            propertyId: "$property._id",
            propertyName: "$property.propertyName",
          },

          client: {
            clientId: "$client._id",
            name: "$client.name",
          },

          assignedBy: {
            userId: "$assignedBy._id",
            name: {
              $concat: [
                { $ifNull: ["$assignedBy.firstName", ""] },
                " ",
                { $ifNull: ["$assignedBy.lastName", ""] },
              ],
            },
          },

          subTasks: 1,
        },
      },
    ];

    const task = await Task.aggregate(pipeline);

    if (!task.length) {
      return res.status(404).json({
        message: "Task not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      data: task[0],
    });

  } catch (error) {
    console.error("Get task by id error:", error);
    return res.status(500).json({
      message: "Failed to fetch task",
    });
  }
};

exports.getAllClientsForSuperAdmin = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search = "" } = req.query;

    const pipeline = [
      {
        $match: {
          isDeleted: false,
          ...(search && {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { phone: { $regex: search, $options: "i" } },
              { city: { $regex: search, $options: "i" } },
              { state: { $regex: search, $options: "i" } },
            ],
          }),
        },
      },

      // 🔹 Get properties directly via clientId
      {
        $lookup: {
          from: "properties",
          localField: "_id", // Client _id
          foreignField: "client", // <-- IMPORTANT (as you confirmed)
          as: "properties",
        },
      },

      // 🔹 Get contracts for task count
      {
        $lookup: {
          from: "contracts",
          localField: "_id",
          foreignField: "client",
          as: "contracts",
        },
      },

      // 🔹 Pagination + projection
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },

            {
              $project: {
                _id: 0,
                clientId: "$_id",

                name: 1,
                clientLogo: 1,
                email: 1,
                phone: 1,
                createdAt: 1,

                // ✅ PROPERTY NAMES
                propertyNames: {
                  $cond: [
                    { $gt: [{ $size: "$properties" }, 0] },
                    {
                      $map: {
                        input: "$properties",
                        as: "property",
                        in: "$$property.propertyName",
                      },
                    },
                    [],
                  ],
                },

                // ✅ TOTAL TASK COUNT (from contracts)
                totalTasks: {
                  $sum: {
                    $map: {
                      input: "$contracts",
                      as: "contract",
                      in: {
                        $size: {
                          $ifNull: ["$$contract.tasks", []],
                        },
                      },
                    },
                  },
                },
              },
            },
          ],

          totalCount: [{ $count: "total" }],
        },
      },
    ];

    const result = await Client.aggregate(pipeline);

    const clients = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: clients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all clients error:", error);
    return res.status(500).json({
      message: "Failed to fetch clients",
    });
  }
};

exports.getAllPropertiesForSuperAdmin = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search = "", clientId } = req.query;

    const pipeline = [
      // 🔹 Base filter
      {
        $match: {
          isDeleted: false,
          ...(clientId &&
            mongoose.Types.ObjectId.isValid(clientId) && {
            client: new mongoose.Types.ObjectId(clientId),
          }),
        },
      },

      // 🔹 Search filter
      {
        $match: {
          ...(search && {
            $or: [
              { propertyName: { $regex: search, $options: "i" } },
              { propertyType: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
            ],
          }),
        },
      },

      // 🔹 Client
      {
        $lookup: {
          from: "clients",
          localField: "client",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: "$client" },

      //  Company
      {
        $lookup: {
          from: "companies",
          localField: "client.company",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: "$company" },

      //  Contracts for task count
      {
        $lookup: {
          from: "contracts",
          localField: "_id", // Property _id
          foreignField: "property", // Contract.property
          as: "contracts",
        },
      },

      //  Pagination + projection
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },

            {
              $project: {
                _id: 0,
                propertyId: "$_id",

                propertyName: 1,
                propertyType: 1,
                description: 1,
                sizeSqm: 1,
                location: 1,
                noOfResidents: 1,
                specialFeatureEndDate: 1,
                createdAt: 1,

                client: {
                  clientId: "$client._id",
                  clientName: "$client.name",
                  email: "$client.email",
                  phone: "$client.phone",
                },

                company: {
                  companyId: "$company._id",
                  companyName: "$company.companyName",
                },

                // TOTAL TASKS FOR THIS PROPERTY
                totalTasks: {
                  $sum: {
                    $map: {
                      input: "$contracts",
                      as: "contract",
                      in: {
                        $size: {
                          $ifNull: ["$$contract.tasks", []],
                        },
                      },
                    },
                  },
                },
              },
            },
          ],

          totalCount: [{ $count: "total" }],
        },
      },
    ];

    const result = await Property.aggregate(pipeline);

    const properties = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: properties,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all properties error:", error);
    return res.status(500).json({
      message: "Failed to fetch properties",
    });
  }
};

exports.createRunnerEmployee = async (req, res) => {
  try {
    if (!["superAdmin"].includes(req.user.role.name)) {
      return res.status(403).json({
        message: "Only admin can create runner employee",
      });
    }

    const { firstName, lastName, email, phone, gender } = req.body;
    console.log("req.body", req.body);
    if (!firstName || !email || !phone) {
      return res.status(400).json({
        message: "Missing firstName or email or phone or required fields",
      });
    }
    const {
      paymentType,
      hourlyRate,
      perServiceRate,
      fixedSalary,
      pf,
      esi,
      tax,
      otherDeduction,
      bonus,
    } = req.body;

    // ✅ paymentType required
    if (!paymentType) {
      return res.status(400).json({
        message: "paymentType is required",
      });
    }

    // ✅ validate based on type
    if (paymentType === "hourly" && !hourlyRate) {
      return res.status(400).json({
        message: "hourlyRate is required for hourly payment",
      });
    }

    if (paymentType === "per_service" && !perServiceRate) {
      return res.status(400).json({
        message: "perServiceRate is required for per_service payment",
      });
    }

    if (paymentType === "fixed" && !fixedSalary) {
      return res.status(400).json({
        message: "fixedSalary is required for fixed payment",
      });
    }

    // ✅ REQUIRED deductions
    if (pf === undefined || esi === undefined || tax === undefined) {
      return res.status(400).json({
        message: "pf, esi and tax are required fields",
      });
    }
    const existingEmail = await User.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });

    if (existingEmail) {
      return res.status(409).json({
        message: "Employee already exists with this email",
      });
    }

    const existingPhoneNumber = await User.findOne({
      phone,
      isDeleted: false,
    });

    if (existingPhoneNumber) {
      return res.status(409).json({
        message: "Employee already exists with this phone number",
      });
    }

    const employeeRole = await Role.findOne({ name: "runner_employee" });
    if (!employeeRole) {
      return res.status(500).json({
        message: "Employee role not found",
      });
    }

    const plainPassword = generateRandomPassword(10);

    const profileImageFile = req.files?.profileImage?.[0];
    const idImageFiles = req.files?.idImages || [];
    const aadhaarImageFiles = req.files?.aadhaarImages || [];

    let childrens = [];

    if (req.body.childrens) {
      try {
        childrens = JSON.parse(req.body.childrens);

        if (!Array.isArray(childrens)) {
          return res.status(400).json({
            message: "childrens must be an array",
          });
        }
      } catch (err) {
        return res.status(400).json({
          message: "Invalid childrens format",
        });
      }
    }

    const employeeProfile = {
      jobPosition: req.body.jobPosition,
      startDate: req.body.startDate,

      workHoursAndAvailability: req.body.workHoursAndAvailability,
      professionalQualifications: req.body.professionalQualifications,
      workExperience: req.body.workExperience,
      languageSkills: req.body.languageSkills,
      specialSkills: req.body.specialSkills,
      assignmentAreas: req.body.assignmentAreas,

      medicalInformation: req.body.medicalInformation,
      emergencyContacts: req.body.emergencyContacts,

      socialSecurityNumber: req.body.socialSecurityNumber,
      taxInformation: req.body.taxInformation,

      dateOfBirth: req.body.dateOfBirth,
      privateAddress: req.body.privateAddress,
      privatePhoneNumber: req.body.privatePhoneNumber,

      ahvNumber: req.body.ahvNumber,
      employeePayment: {
        paymentType: req.body.paymentType || "fixed",

        hourlyRate: Number(req.body.hourlyRate) || 0,
        perServiceRate: Number(req.body.perServiceRate) || 0,
        fixedSalary: Number(req.body.fixedSalary) || 0,

        // ✅ ADD DEDUCTIONS
        deductions: {
          pf: Number(req.body.pf) || 0,       // %
          esi: Number(req.body.esi) || 0,     // %
          tax: Number(req.body.tax) || 0,     // %
          other: Number(req.body.otherDeduction) || 0 // fixed ₹
        },

        // ✅ ADD BONUS
        bonus: Number(req.body.bonus) || 0
      },
      childrens,
      bankAccountInformation: req.body.bankAccountInformation || null,

      bonusAndBenefits: req.body.bonusAndBenefits,
      employmentContract: req.body.employmentContract,
      contractChanges: req.body.contractChanges,
      notice: req.body.notice,

      performanceEvaluations: req.body.performanceEvaluations,
      disciplinary: req.body.disciplinary,
      futureDevelopmentPlans: req.body.futureDevelopmentPlans,

      access: req.body.access,
      security: req.body.security,

      profileImage: profileImageFile
        ? {
          fileName: profileImageFile.originalname,
          fileUrl: `/uploads/profile-images/${profileImageFile.filename}`,
        }
        : null,

      documents: {
        idImages: idImageFiles.map((file) => ({
          fileName: file.originalname,
          fileUrl: `/uploads/id-images/${file.filename}`,
        })),
        aadhaarImages: aadhaarImageFiles.map((file) => ({
          fileName: file.originalname,
          fileUrl: `/uploads/aadhaar-images/${file.filename}`,
        })),
      },
    };

    const employee = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      gender,
      password: plainPassword,
      role: employeeRole._id,
      company: req.user.company,
      isApproved: "approved",
      employeeProfile,
    });

    // try {
    //     const mail = employeeWelcomeTemplate({
    //         fullName: `${firstName} ${lastName}`,
    //         email,
    //         password: plainPassword,
    //         companyName,
    //     });

    //     await sendSimpleMail({
    //         to: email,
    //         subject: mail.subject,
    //         html: mail.html,
    //         text: mail.text,
    //     });
    // } catch (mailError) {
    //     await User.findByIdAndDelete(employee._id);
    //     throw new Error("Employee created but email failed");
    // }

    return res.status(201).json({
      message: "Employee created successfully and email sent",
    });
  } catch (error) {
    console.error("Create employee error:", error);

    if (req.files) {
      const allFiles = [
        ...(req.files.profileImage || []),
        ...(req.files.idImages || []),
        ...(req.files.aadhaarImages || []),
      ];

      allFiles.forEach((file) => {
        fs.unlink(path.join(file.destination, file.filename), () => { });
      });
    }

    return res.status(500).json({
      message: error.message || "Failed to create employee",
    });
  }
};


exports.getAllRunnerEmployees = async (req, res) => {
  try {
    if (!["superAdmin"].includes(req.user.role.name)) {
      return res.status(403).json({
        message: "Only superAdmin can view runner employees",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const runnerRole = await Role.findOne({ name: "runner_employee" });

    if (!runnerRole) {
      return res.status(500).json({
        message: "Runner employee role not found",
      });
    }

    const filter = {
      role: runnerRole._id,
      isDeleted: false,
    };

    const total = await User.countDocuments(filter);

    const runners = await User.find(filter, {
      firstName: 1,
      lastName: 1,
      email: 1,
      phone: 1,
      gender: 1,
      isApproved: 1,
      employeeProfile: 1,
      createdAt: 1,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      message: "Runner employees fetched successfully",
      data: runners,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get runners error:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch runners",
    });
  }
};

exports.getRunnerEmployeeDetails = async (req, res) => {
  try {
    if (!["superAdmin"].includes(req.user.role.name)) {
      return res.status(403).json({
        message: "Only superAdmin can view runner employee details",
      });
    }

    const { runnerId } = req.params;

    const runnerRole = await Role.findOne({ name: "runner_employee" });

    if (!runnerRole) {
      return res.status(500).json({
        message: "Runner employee role not found",
      });
    }

    const runner = await User.findOne(
      {
        _id: runnerId,
        role: runnerRole._id,
        isDeleted: false,
      },
      {
        firstName: 1,
        lastName: 1,
        email: 1,
        phone: 1,
        gender: 1,
        isApproved: 1,
        company: 1,
        employeeProfile: 1,
        documents: 1,
        createdAt: 1,
      },
    ).lean();

    if (!runner) {
      return res.status(404).json({
        message: "Runner employee not found",
      });
    }

    return res.status(200).json({
      message: "Runner employee details fetched successfully",
      data: runner,
    });
  } catch (error) {
    console.error("Get runner details error:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch runner details",
    });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log("employee", req.files);
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: "Invalid employee id" });
    }

    const employee = await User.findOne({
      _id: employeeId,
      isDeleted: false,
      employeeProfile: { $ne: null },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    let passwordChanged = false;
    let newPlainPassword = null;

    if (req.body.password) {
      newPlainPassword = req.body.password;
      employee.password = newPlainPassword;
      passwordChanged = true;
    }

    if (req.body.email && req.body.email !== employee.email) {
      const emailExists = await User.findOne({
        email: req.body.email.toLowerCase(),
        _id: { $ne: employeeId },
        isDeleted: false,
      });
      if (emailExists) {
        return res.status(409).json({ message: "Email already in use" });
      }
      employee.email = req.body.email.toLowerCase();
    }

    if (req.body.phone && req.body.phone !== employee.phone) {
      const phoneExists = await User.findOne({
        phone: req.body.phone,
        _id: { $ne: employeeId },
        isDeleted: false,
      });
      if (phoneExists) {
        return res.status(409).json({ message: "Phone number already in use" });
      }
      employee.phone = req.body.phone;
    }

    ["firstName", "lastName", "gender"].forEach((field) => {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    });

    let childrens;

    if (req.body.childrens !== undefined) {
      try {
        childrens = JSON.parse(req.body.childrens);

        if (!Array.isArray(childrens)) {
          return res.status(400).json({
            message: "childrens must be an array",
          });
        }
        childrens.forEach((child, index) => {
          if (!child.name || !child.gender || !child.dateOfBirth) {
            throw new Error(`Invalid children data at index ${index}`);
          }
        });
      } catch (err) {
        return res.status(400).json({
          message: "Invalid childrens format",
        });
      }
    }

    const profileFields = [
      "jobPosition",
      "startDate",
      "workHoursAndAvailability",
      "professionalQualifications",
      "workExperience",
      "languageSkills",
      "specialSkills",
      "assignmentAreas",
      "medicalInformation",
      "emergencyContacts",
      "socialSecurityNumber",
      "taxInformation",
      "dateOfBirth",
      "privateAddress",
      "privatePhoneNumber",
      "ahvNumber",
      "salaryAndWageDetails",
      "bonusAndBenefits",
      "employmentContract",
      "contractChanges",
      "notice",
      "performanceEvaluations",
      "disciplinary",
      "futureDevelopmentPlans",
      "access",
      "security",
    ];

    profileFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        employee.employeeProfile[field] = req.body[field];
      }
    });
    if (childrens !== undefined) {
      employee.employeeProfile.childrens = childrens;
    }

    if (req.body.bankAccountInformation) {
      employee.employeeProfile.bankAccountInformation = {
        ...employee.employeeProfile.bankAccountInformation,
        ...req.body.bankAccountInformation,
      };
    }

    const profileImageFile = req.files?.profileImage?.[0];
    const idImageFiles = req.files?.idImages;
    const aadhaarImageFiles = req.files?.aadhaarImages;

    if (profileImageFile) {
      if (employee.employeeProfile.profileImage?.fileUrl) {
        fs.unlink(
          path.join(
            process.cwd(),
            employee.employeeProfile.profileImage.fileUrl,
          ),
          () => { },
        );
      }

      employee.employeeProfile.profileImage = {
        fileName: profileImageFile.originalname,
        fileUrl: `/uploads/profile-images/${profileImageFile.filename}`,
      };
    }

    if (idImageFiles) {
      employee.employeeProfile.documents.idImages.forEach((doc) => {
        fs.unlink(path.join(process.cwd(), doc.fileUrl), () => { });
      });

      employee.employeeProfile.documents.idImages = idImageFiles.map(
        (file) => ({
          fileName: file.originalname,
          fileUrl: `/uploads/id-images/${file.filename}`,
        }),
      );
    }

    if (aadhaarImageFiles) {
      employee.employeeProfile.documents.aadhaarImages.forEach((doc) => {
        fs.unlink(path.join(process.cwd(), doc.fileUrl), () => { });
      });

      employee.employeeProfile.documents.aadhaarImages = aadhaarImageFiles.map(
        (file) => ({
          fileName: file.originalname,
          fileUrl: `/uploads/aadhaar-images/${file.filename}`,
        }),
      );
    }

    await employee.save();

    // if (passwordChanged) {
    //     try {
    //         const mail = passwordUpdatedTemplate({
    //             fullName: `${employee.firstName} ${employee.lastName}`,
    //             email: employee.email,
    //             password: newPlainPassword,
    //
    //         });

    //         await sendSimpleMail({
    //             to: employee.email,
    //             subject: mail.subject,
    //             html: mail.html,
    //             text: mail.text,
    //         });
    //     } catch (mailError) {
    //         console.error("Password email failed:", mailError);
    //     }
    // }

    const result = employee.toObject();
    delete result.password;

    return res.status(200).json({
      message: passwordChanged
        ? "Employee updated and password email sent"
        : "Employee updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Update employee error:", error);

    if (req.files) {
      const files = [
        ...(req.files.profileImage || []),
        ...(req.files.idImages || []),
        ...(req.files.aadhaarImages || []),
      ];

      files.forEach((file) => {
        fs.unlink(path.join(file.destination, file.filename), () => { });
      });
    }

    return res.status(500).json({
      message: "Failed to update employee",
    });
  }
};


exports.getSuperAdminDashboard = async (req, res) => {
  try {
    /* ================= BASIC COUNTS ================= */

    const totalCompanies = await Company.countDocuments({
      isDeleted: false,
    });

    const totalEmployees = await User.countDocuments({
      isDeleted: false,
    });

    const totalContracts = await Contract.countDocuments();
    const totalTasks = await Task.countDocuments();

    /* ================= FINANCIAL ================= */

    const earningAgg = await Invoice.aggregate([
      { $match: { remainingAmount: 0 } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalIncome = earningAgg[0]?.total || 0;

    const pendingAgg = await Invoice.aggregate([
      { $match: { remainingAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$remainingAmount" } } },
    ]);

    const pendingAmount = pendingAgg[0]?.total || 0;

    const expenseAgg = await EmployeePayment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalExpense = expenseAgg[0]?.total || 0;

    const netProfit = totalIncome - totalExpense;

    /* ================= CHARTS ================= */

    const monthlyIncome = await Invoice.aggregate([
      { $match: { remainingAmount: 0 } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const monthlyPending = await Invoice.aggregate([
      { $match: { remainingAmount: { $gt: 0 } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$remainingAmount" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const monthlyExpense = await EmployeePayment.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const taskTrend = await Task.aggregate([
      {
        $group: {
          _id: { $year: "$createdAt" },
          total: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    /* ================= 🔥 LATEST COMPANIES ================= */

    const latestCompanies = await Company.find({
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("planId", "planName monthlyFee annualFee")
      .populate("createdBy", "firstName lastName email")
      .lean();

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const formattedCompanies = latestCompanies.map((c) => ({
      ...c,

      // ✅ logo
      logo: c.logo ? `${baseUrl}${c.logo}` : null,

      // ✅ license documents
      licenseDocuments: c.licenseDocuments?.map((doc) => ({
        ...doc,
        fileUrl: `${baseUrl}${doc.fileUrl}`,
      })) || [],
    }));

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,
      data: {
        cards: {
          totalContracts,
          totalCompanies,
          totalEmployees,
          totalTasks,
          totalIncome,
          pendingAmount,
          totalExpense,
          netProfit,
        },

        charts: {
          monthlyIncome,
          monthlyPending,
          monthlyExpense,
          taskTrend,
        },

        latestCompanies: formattedCompanies, // 🔥 NEW
      },
    });

  } catch (error) {
    console.error("Super admin dashboard error:", error);
    return res.status(500).json({
      message: "Failed to load dashboard",
    });
  }
};


exports.getEmployeePayments = async (req, res) => {
  try {
    const { role, company } = req.user;

    const {
      page = 1,
      limit = 10,
      status,
      employeeId,
      startDate,
      endDate,
      groupByEmployee,
    } = req.query;

    const skip = (page - 1) * limit;

    /* ================= QUERY ================= */

    const query = {};

    // 🔐 Role filter
    if (role.name !== "superAdmin") {
      query.company = company;
    }

    // 🔍 Filters
    if (status) {
      query.status = status;
    }

    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
      query.employee = new mongoose.Types.ObjectId(employeeId);
    }

    // 📅 Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    /* ================= SUMMARY ================= */

    const summaryAgg = await EmployeePayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
            },
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const summary = summaryAgg[0] || {
      totalAmount: 0,
      totalPaid: 0,
      totalPending: 0,
    };

    /* ================= GROUP BY EMPLOYEE ================= */

    let employeeSummary = [];

    if (groupByEmployee === "true") {
      employeeSummary = await EmployeePayment.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$employee",
            totalAmount: { $sum: "$amount" },
            totalTasks: { $sum: "$totalTasks" },
            totalTime: { $sum: "$totalTimeSeconds" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "employee",
          },
        },
        { $unwind: "$employee" },
        {
          $project: {
            employeeId: "$employee._id",
            name: {
              $concat: [
                "$employee.firstName",
                " ",
                "$employee.lastName",
              ],
            },
            totalAmount: 1,
            totalTasks: 1,
            totalTime: 1,
          },
        },
        { $sort: { totalAmount: -1 } },
      ]);
    }

    /* ================= LIST ================= */

    const [payments, total] = await Promise.all([
      EmployeePayment.find(query)
        .populate("employee", "firstName lastName profilePic")
        .populate("contract", "contractNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),

      EmployeePayment.countDocuments(query),
    ]);

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      success: true,

      summary, // 💰 payout summary

      employeeSummary, // 📊 grouping (optional)

      data: payments,

      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("getEmployeePayments error:", error);
    return res.status(500).json({
      message: "Failed to fetch employee payments",
    });
  }
};


exports.getAllDocuments = async (req, res) => {
  try {
    const {
      search = "",
      type, // employee | contract
      page = 1,
      limit = 10,
    } = req.query;

    const user = req.user;

    const pageNumber = Math.max(parseInt(page), 1);
    const limitNumber = Math.max(parseInt(limit), 1);

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const formatUrl = (url) => {
      if (!url) return null;
      return url.startsWith("http") ? url : `${baseUrl}${url}`;
    };

    // ================= ROLE FILTER =================
    let userFilter = { isDeleted: false };
    let contractFilter = { isDeleted: false };

    if (user.role.name !== "superAdmin") {
      userFilter.company = user.company;
      contractFilter.company = user.company;
    }

    // ================= SEARCH =================
    if (search) {
      const regex = new RegExp(search, "i");

      userFilter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: search,
              options: "i",
            },
          },
        },
      ];

      contractFilter.$or = [
        { contractNumber: regex },
        { invoiceNumber: regex },
        { referenceNumber: regex },
      ];
    }

    let groupedEmployees = [];
    let groupedContracts = [];

    // ================= EMPLOYEES =================
    if (!type || type === "employee") {
      const users = await User.find(userFilter)
        .select("firstName lastName email employeeProfile")
        .lean();

      groupedEmployees = users
        .map((user) => {
          const profile = user.employeeProfile || {};
          const docs = profile.documents || {};

          const idImages = (docs.idImages || []).map((doc) => ({
            fileName: doc.fileName,
            fileUrl: formatUrl(doc.fileUrl),
            uploadedAt: doc.uploadedAt,
          }));

          const aadhaarImages = (docs.aadhaarImages || []).map((doc) => ({
            fileName: doc.fileName,
            fileUrl: formatUrl(doc.fileUrl),
            uploadedAt: doc.uploadedAt,
          }));

          const profileImage = profile.profileImage
            ? {
              fileName: profile.profileImage.fileName,
              fileUrl: formatUrl(profile.profileImage.fileUrl),
              uploadedAt: profile.profileImage.uploadedAt,
            }
            : null;

          // ❌ skip if no documents
          if (
            !profileImage &&
            idImages.length === 0 &&
            aadhaarImages.length === 0
          ) {
            return null;
          }

          return {
            type: "employee",
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            email: user.email,
            documents: {
              profileImage,
              idImages,
              aadhaarImages,
            },
          };
        })
        .filter(Boolean);
    }

    // ================= CONTRACTS =================
    if (!type || type === "contract") {
      const contracts = await Contract.find(contractFilter)
        .select(
          "contractNumber invoiceNumber referenceNumber additionalDocuments"
        )
        .lean();

      groupedContracts = contracts
        .map((contract) => {
          const documents = (contract.additionalDocuments || []).map(
            (doc) => ({
              fileName: doc.fileName,
              fileUrl: formatUrl(doc.fileUrl),
              uploadedAt: doc.uploadedAt,
            })
          );

          // ❌ skip if no documents
          if (documents.length === 0) return null;

          return {
            type: "contract",
            contractNumber: contract.contractNumber,
            invoiceNumber: contract.invoiceNumber,
            referenceNumber: contract.referenceNumber,
            documents,
          };
        })
        .filter(Boolean);
    }

    // ================= MERGE =================
    let allData = [...groupedEmployees, ...groupedContracts];

    // ================= OPTIONAL SORT (LATEST FIRST) =================
    allData.sort((a, b) => {
      const getLatestDate = (item) => {
        if (item.type === "employee") {
          const dates = [
            item.documents.profileImage?.uploadedAt,
            ...item.documents.idImages.map((d) => d.uploadedAt),
            ...item.documents.aadhaarImages.map((d) => d.uploadedAt),
          ].filter(Boolean);

          return dates.length ? new Date(Math.max(...dates)) : new Date(0);
        }

        if (item.type === "contract") {
          const dates = item.documents.map((d) => d.uploadedAt);
          return dates.length ? new Date(Math.max(...dates)) : new Date(0);
        }
      };

      return getLatestDate(b) - getLatestDate(a);
    });

    // ================= PAGINATION =================
    const total = allData.length;
    const startIndex = (pageNumber - 1) * limitNumber;

    const paginatedData = allData.slice(
      startIndex,
      startIndex + limitNumber
    );

    return res.status(200).json({
      success: true,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
      data: paginatedData,
    });
  } catch (error) {
    console.error("Get Documents Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch documents",
    });
  }
};




