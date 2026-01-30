const fs = require("fs");
const path = require("path");
const { createCompanyAndAdmin } = require("../services/company.service");
const Company = require("../models/company");
const mongoose = require("mongoose");
const User = require("../models/user");
const { deleteFileIfExists } = require("../functions/common");

exports.adminCreateCompany = async (req, res) => {
  try {
    const files = req.files || [];
    const licenseDocuments = files.map((file) => ({
      fileName: file.originalname,
      fileUrl: `/uploads/licenses/${file.filename}`,
    }));

    const {
      companyName,
      contactEmail,
      phoneNumber,
      adminPassword,
      licenseNo,
      licenseExpiryDate,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      pincode,
    } = req.body;

    if (
      !companyName ||
      !contactEmail ||
      !phoneNumber ||
      !adminPassword
    ) {
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
    const { company, companyAdmin } =
      await createCompanyAndAdmin({
        companyData: {
          companyName,
          contactEmail,
          phoneNumber,
          licenseNo,
          licenseExpiryDate,
          address,
          licenseDocuments,
        },
        adminData: {
          email: contactEmail,
          phone: phoneNumber,
          password: adminPassword,
          isApproved,
        },
        createdByUserId: req.user._id,
      });

    return res.status(201).json({
      message: "Company and Company Admin created successfully",
      companyId: company._id,
      adminId: companyAdmin._id,
    });
  } catch (err) {
    if (req.files?.length) {
      req.files.forEach((file) => {
        fs.unlink(
          path.join("uploads/licenses", file.filename),
          () => { }
        );
      });
    }

    return res.status(400).json({
      message: err.message,
    });
  }
};

// exports.getAllCompanies = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const search = req.query.search || "";
//     const city = req.query.city || "";

//     const skip = (page - 1) * limit;

//     const filter = {
//       isDeleted: false,
//       ...(city && {
//         "address.city": { $regex: city, $options: "i" },
//       }),
//       ...(search && {
//         $or: [
//           { companyName: { $regex: search, $options: "i" } },
//           { contactEmail: { $regex: search, $options: "i" } },
//           { phoneNumber: { $regex: search, $options: "i" } },
//         ],
//       }),
//     };

//     const [companies, total] = await Promise.all([
//       Company.find(filter)
//         .populate("planId", "planName monthlyFee annualFee")
//         .populate("createdBy", "firstName lastName email")
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),

//       Company.countDocuments(filter),
//     ]);

//     const baseUrl = `${req.protocol}://${req.get("host")}`;

//     const companiesWithFullUrls = companies.map((company) => ({
//       ...company,
//       licenseDocuments: company.licenseDocuments?.map((doc) => ({
//         ...doc,
//         fileUrl: `${baseUrl}${doc.fileUrl}`,
//       })),
//     }));

//     return res.status(200).json({
//       message: "Companies fetched successfully",
//       data: companiesWithFullUrls,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     console.error("Get companies error:", error);
//     return res.status(500).json({
//       message: "Failed to fetch companies",
//     });
//   }
// };


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
                as: "role",
              },
            },
            { $unwind: "$role" },
            { $match: { "role.name": "company_admin" } },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                isApproved: 1,
              },
            },
          ],
          as: "admin",
        },
      },


      {
        $addFields: {
          admin: { $first: "$admin" },
        },
      },

      {
        $project: {
          companyName: 1,
          contactEmail: 1,
          phoneNumber: 1,
          createdAt: 1,
          address: { city: "$address.city" },

          licenseExpiryDate: 1,
          subscriptionStatus: 1,

          admin: {
            name: { $concat: ["$admin.firstName", " ", "$admin.lastName"] },
            isApproved: "$admin.isApproved",
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
      subscriptionStatus: "pending",
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
              $lookup: {
                from: "roles",
                localField: "role",
                foreignField: "_id",
                as: "role",
              },
            },
            { $unwind: "$role" },
            { $match: { "role.name": "company_admin" } },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                isApproved: 1,
              },
            },
          ],
          as: "admin",
        },
      },

      { $addFields: { admin: { $first: "$admin" } } },

      {
        $project: {
          companyName: 1,
          contactEmail: 1,
          phoneNumber: 1,
          createdAt: 1,
          address: { city: "$address.city" },
          licenseExpiryDate: 1,
          subscriptionStatus: 1,
          admin: {
            name: {
              $cond: [
                { $ifNull: ["$admin", false] },
                { $concat: ["$admin.firstName", " ", "$admin.lastName"] },
                null,
              ],
            },
            isApproved: "$admin.isApproved",
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
    console.error("Pending subscription companies error:", error);
    return res.status(500).json({ message: "Failed to fetch pending companies" });
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
      subscriptionStatus: "active",
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
              $lookup: {
                from: "roles",
                localField: "role",
                foreignField: "_id",
                as: "role",
              },
            },
            { $unwind: "$role" },
            { $match: { "role.name": "company_admin" } },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                isApproved: 1,
              },
            },
          ],
          as: "admin",
        },
      },

      { $addFields: { admin: { $first: "$admin" } } },

      {
        $project: {
          companyName: 1,
          contactEmail: 1,
          phoneNumber: 1,
          createdAt: 1,
          address: { city: "$address.city" },
          licenseExpiryDate: 1,
          subscriptionStatus: 1,
          admin: {
            name: {
              $cond: [
                { $ifNull: ["$admin", false] },
                { $concat: ["$admin.firstName", " ", "$admin.lastName"] },
                null,
              ],
            },
            isApproved: "$admin.isApproved",
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
    return res.status(500).json({ message: "Failed to fetch active companies" });
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


    const baseUrl = `${req.protocol}://${req.get("host")}`;

    if (company.licenseDocuments?.length) {
      company.licenseDocuments = company.licenseDocuments.map((doc) => ({
        ...doc,
        fileUrl: `${baseUrl}${doc.fileUrl}`,
      }));
    }

    return res.status(200).json({
      message: "Company fetched successfully",
      data: company,
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
    if (licenseNo || licenseExpiryDate) {
      updateData.licenseNo = licenseNo;
      updateData.licenseExpiryDate = licenseExpiryDate;
    }

    /* ---------------- ADDRESS ---------------- */
    if (
      addressLine1 ||
      addressLine2 ||
      city ||
      state ||
      country ||
      pincode
    ) {
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
      { new: true }
    )
      .populate("planId", "planName monthlyFee annualFee")
      .populate("createdBy", "firstName lastName email")
      .lean();

    /* ---------------- BASE URL ---------------- */
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    if (updatedCompany.licenseDocuments?.length) {
      updatedCompany.licenseDocuments =
        updatedCompany.licenseDocuments.map((doc) => ({
          ...doc,
          fileUrl: `${baseUrl}${doc.fileUrl}`,
        }));
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
        fs.unlink(
          path.join("uploads/licenses", file.filename),
          () => { }
        );
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

    if (
      req.user.company &&
      req.user.company.toString() !== companyId
    ) {
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

exports.getAllCompanyAdmins = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const {
      search = "",
      city = "",
      page = 1,
      limit = 10,
    } = req.query;

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
    return res.status(500).json({ message: "Failed to fetch pending company admins" });
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
    return res.status(500).json({ message: "Failed to fetch approved company admins" });
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

    const {
      email,
      phone,
      gender,
      isApproved,
    } = req.body;

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
      { new: true }
    )
      .select("-password")
      .populate("role", "name");

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

    const profilePic =
      req.file.path || req.file.location || req.file.url;

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
        { $set: { isDeleted: newIsDeleted } }
      ),

      User.updateMany(
        {
          company: companyId,
        },
        { $set: { isDeleted: newIsDeleted } }
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
