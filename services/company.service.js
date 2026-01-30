const mongoose = require("mongoose");
const Company = require("../models/company");
const User = require("../models/user");
const Role = require("../models/role");

exports.createCompanyAndAdmin = async ({
  companyData,
  adminData,
  createdByUserId,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const companyAdminRole = await Role.findOne({ name: "company_admin" });
    if (!companyAdminRole) {
      throw new Error("Company admin role not found");
    }
 

    const existingEmail = await User.findOne({
      isDeleted: false,
      $or: [
        { email: adminData.email.toLowerCase() }
      ]
    });

    if (existingEmail) {
      throw new Error("Email already registered");
    }

    // const existingPhone = await User.findOne({
    //   isDeleted: false,
    //   $or: [
    //     { phone: adminData.phoneNumber } 
    //   ]
    // });

    // if (existingPhone) {
    //   throw new Error("Phone number already registered");
    // }

    const [company] = await Company.create(
      [
        {
          ...companyData,
          createdBy: createdByUserId,
        },
      ],
      { session }
    );

    const [companyAdmin] = await User.create(
      [
        {
          ...adminData,
          role: companyAdminRole._id,
          company: company._id,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return { company, companyAdmin };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
