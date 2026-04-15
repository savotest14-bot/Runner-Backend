const jwt = require("jsonwebtoken");
const User = require("../models/user");
const TokenBlacklist = require("../models/tokenBlacklist");
const Company = require("../models/company");

const ROLES = {
  SUPER_ADMIN: "superAdmin",
  COMPANY_ADMIN: "company_admin",
  EMPLOYEE: "employee",
};

const APPROVAL_STATUS = {
  APPROVED: "approved",
  PENDING: "pending",
  REJECTED: "rejected",
  BANNED: "banned",
};

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];


    const blacklisted = await TokenBlacklist.findOne({ token }).lean();
    if (blacklisted) {
      return res.status(401).json({
        message: "Token has been logged out",
      });
    }


    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id)
      .populate("role")
      .lean();

    if (!user || user.isDeleted) {
      return res.status(401).json({ message: "Unauthorized" });
    }


    const roleName = user.role?.name;

    if (
      roleName !== ROLES.SUPER_ADMIN &&
      [ROLES.COMPANY_ADMIN, ROLES.EMPLOYEE].includes(roleName)
    ) {
      if (user.isApproved !== APPROVAL_STATUS.APPROVED) {
        const messages = {
          pending: "Your account is pending approval.",
          rejected: "Your account has been rejected.",
          banned: "Your account has been banned.",
        };

        return res.status(403).json({
          message: messages[user.isApproved] || "Account not approved",
        });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};
