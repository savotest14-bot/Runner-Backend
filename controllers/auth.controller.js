const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Role = require("../models/role");
const path = require("path");
const fs = require("fs");
const { createCompanyAndAdmin } = require("../services/company.service");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const {
  generateOTP,
  hashOTP,
  verifyOTPAndPassword,
  humanize,
  paginate
} = require("../functions/common");
const { sendMail } = require("../functions/mailer");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const TokenBlacklist = require("../models/tokenBlacklist");
const Company = require("../models/company");
const Group = require("../models/group");


const ROLES = {
  SUPER_ADMIN: "superAdmin",
  COMPANY_ADMIN: "company_admin",
  EMPLOYEE: "employee",
};

const APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  BANNED: "banned",
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      isDeleted: false,
    })
      .select("+password")
      .populate("role");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }
    const roleName = user.role.name;

    if (
      roleName !== ROLES.SUPER_ADMIN &&
      [ROLES.COMPANY_ADMIN, ROLES.EMPLOYEE].includes(roleName)
    ) {
      switch (user.isApproved) {
        case APPROVAL_STATUS.PENDING:
          return res.status(403).json({
            message: "Your account is pending approval.",
          });

        case APPROVAL_STATUS.REJECTED:
          return res.status(403).json({
            message: "Your account has been rejected.",
          });

        case APPROVAL_STATUS.BANNED:
          return res.status(403).json({
            message: "Your account has been banned.",
          });

        case APPROVAL_STATUS.APPROVED:
          break;

        default:
          return res.status(403).json({
            message: "Invalid account status.",
          });
      }
    }

    let companySubscriptionStatus = null;

    if (user.role?.name === "company_admin") {
      if (!user.company) {
        return res.status(403).json({
          message: "Company admin is not linked to a company",
        });
      }

      const company = await Company.findOne({
        _id: user.company,
        isDeleted: false,
      }).lean();

      if (!company) {
        return res.status(403).json({
          message: "Company not found",
        });
      }

      companySubscriptionStatus = company.subscriptionStatus;
    }

    const tokenPayload = {
      id: user._id,
      role: user.role.name,
      company: user.company || null,
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: "5d" }
    );

    let isGroupAdmin = false;
    let groupRoles = [];

    if (user.role.name === ROLES.EMPLOYEE) {
      const groups = await Group.find({
        "members.user": user._id,
      }).select("members task contract assignmentType");

      groupRoles = groups.map(group => {
        const member = group.members.find(
          m => m.user.toString() === user._id.toString()
        );

        if (member?.role === "GROUP_ADMIN") {
          isGroupAdmin = true;
        }

        return {
          groupId: group._id,
          role: member?.role,
          task: group.task,
          contract: group.contract,
          assignmentType: group.assignmentType
        };
      });
    }
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.name,
        ...(user.role.name === "company_admin" && {
          company: user.company,
          subscriptionStatus: companySubscriptionStatus,
        }),
        // scope: user.role.scope,
        // permissions: user.role.permissions,
        // company: user.company || null,
        isGroupAdmin,
        // groupRoles
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Login failed",
    });
  }
};


exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne(
      {
        email: email.toLowerCase().trim(),
        isDeleted: false,
      },
      {
        firstName: 1,
        lastName: 1,
        email: 1,
        role: 1,
      }
    ).lean(true);

    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const otp = generateOTP();
    const hashOtp = await hashOTP(otp);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          otp: hashOtp,
          otpExpiry: moment()
            .add(10, "minutes")
            .utc()
            .toDate(),
        },
      }
    );
    const mailVariable = {
      "%fullName%": `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      "%otp%": otp,
    };

    await sendMail("otp-verify", mailVariable, user.email);

    return res.status(200).json({
      message: "OTP sent successfully",
      data: user._id,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne(
      {
        email: email.toLowerCase().trim(),
        isDeleted: false,
      },
      {
        firstName: 1,
        lastName: 1,
        email: 1,
      }
    ).lean(true);

    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    if (user.otpExpiry && moment(user.otpExpiry).isAfter(moment().subtract(1, "minutes"))) {
      return res.status(429).json({
        message: "Please wait before requesting another OTP",
      });
    }

    const otp = generateOTP();

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          otp: await hashOTP(otp),
          otpExpiry: moment()
            .add(10, "minutes")
            .utc()
            .toDate(),
        },
      }
    );

    const mailVariable = {
      "%fullName%": `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      "%otp%": otp,
    };

    await sendMail("otp-verify", mailVariable, user.email);

    return res.status(200).json({
      message: "OTP resent successfully",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};


exports.forgotVerifyOTP = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user id",
      });
    }

    if (!otp) {
      return res.status(400).json({
        message: "OTP is required",
      });
    }

    const user = await User.findOne(
      { _id: id, isDeleted: false },
      { otp: 1, otpExpiry: 1 }
    ).lean(true)
    if (!user || !user.otp || !user.otpExpiry) {
      return res.status(400).json({
        message: "OTP not found or already used. Please request a new OTP",
      });
    }

    if (moment().isAfter(user.otpExpiry)) {
      return res.status(400).json({
        message: "OTP has expired. Please request a new one",
      });
    }

    const isValid = await verifyOTPAndPassword(otp, user.otp);

    if (!isValid) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    const token = uuidv4();

    await User.updateOne(
      { _id: id },
      {
        $set: { token },
        $unset: { otp: "", otpExpiry: "" },
      }
    );

    return res.status(200).json({
      message: "OTP verified successfully",
      data: token,
    });
  } catch (error) {
    console.error("forgotVerifyOTP error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
      });
    }

    const user = await User.findOne({
      token,
      isDeleted: false,
    });
    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired token",
      });
    }

    user.password = newPassword;
    user.token = undefined;

    await user.save();

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await TokenBlacklist.create({
      token,
      expiresAt: new Date(decoded.exp * 1000),
    });

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({
        message: "Already logged out",
      });
    }

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};


exports.getRoles = async (req, res) => {
  try {
    const user = req.user;

    let isGroupAdmin = false;
    let groupRoles = [];

    // ======================================================
    // ✅ Get all groups where user exists
    // ======================================================
    const groups = await Group.find({
      company: user.company,
      isDeleted: false,
      "members.user": user._id,
    })
      .select("members task assignmentType")
      .lean();

    // ======================================================
    // ✅ Extract roles
    // ======================================================
    groupRoles = groups.map(group => {
      const member = group.members.find(
        m => m.user.toString() === user._id.toString()
      );

      if (member?.role === "GROUP_ADMIN") {
        isGroupAdmin = true;
      }

      return {
        groupId: group._id,
        role: member?.role || "EMPLOYEE",
        task: group.task || null,
        assignmentType: group.assignmentType,
      };
    });

    // ======================================================
    // ✅ FINAL RESPONSE
    // ======================================================
    return res.status(200).json({
      message: "Roles fetched successfully",
      data: {
        user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.name,
        },
        isGroupAdmin,
        // groupRoles,
      },
    });

  } catch (error) {
    console.error("Get roles error:", error);
    return res.status(500).json({
      message: "Failed to fetch roles",
    });
  }
};

// exports.companyAdminSignup = async (req, res) => {
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
//       password,
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


//     const address = {
//       addressLine1,
//       addressLine2,
//       city,
//       state,
//       country,
//       pincode,
//     };

//     const { company, companyAdmin } =
//       await createCompanyAndAdmin({
//         companyData: {
//           companyName,
//           contactEmail,
//           phoneNumber,
//           licenseNo,
//           licenseExpiryDate,
//           address,
//           licenseDocuments,
//         },
//         adminData: {
//           email: contactEmail,
//           phone: phoneNumber,
//           password,
//           firstName,
//           lastName,
//         },
//         createdByUserId: null,
//       });

//     return res.status(201).json({
//       message: "Signup successful",
//       companyId: company._id,
//       adminId: companyAdmin._id,
//     });
//   } catch (error) {

//     if (req.files?.length) {
//       req.files.forEach((file) => {
//         fs.unlink(
//           path.join("uploads/licenses", file.filename),
//           () => { }
//         );
//       });
//     }

//     return res.status(400).json({
//       message: error.message,
//     });
//   }
// };


exports.companyAdminSignup = async (req, res) => {
  try {
    const files = req.files || {};

    // ✅ License docs
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
      password,
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

    const address = {
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      pincode,
    };

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
          logo: companyLogo, // ✅ ADDED
        },
        adminData: {
          email: contactEmail,
          phone: phoneNumber,
          password,
          firstName,
          lastName,
        },
        createdByUserId: null,
      });

    return res.status(201).json({
      message: "Signup successful",
      companyId: company._id,
      adminId: companyAdmin._id,
    });

  } catch (error) {

    // ✅ cleanup both folders
    if (req.files) {
      Object.values(req.files).flat().forEach((file) => {
        const folder =
          file.fieldname === "companyLogo"
            ? "uploads/company-logos"
            : "uploads/licenses";

        fs.unlink(path.join(folder, file.filename), () => {});
      });
    }

    return res.status(400).json({
      message: error.message,
    });
  }
};