const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");


const bankAccountSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true },
    accountHolderName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    iban: { type: String, trim: true },
    swiftCode: { type: String, trim: true },
    branchName: { type: String, trim: true },
  },
  { _id: false }
);

const fileSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const employeeProfileSchema = new mongoose.Schema(
  {
    jobPosition: String,
    startDate: Date,

    workHoursAndAvailability: String,
    professionalQualifications: String,
    workExperience: String,
    languageSkills: String,
    specialSkills: String,
    assignmentAreas: String,

    medicalInformation: String,
    emergencyContacts: String,

    socialSecurityNumber: String,
    taxInformation: String,

    dateOfBirth: Date,
    privateAddress: String,
    privatePhoneNumber: String,

    ahvNumber: String,

    salaryAndWageDetails: String,

    bankAccountInformation: {
      type: bankAccountSchema,
      default: null,
    },

    bonusAndBenefits: String,

    employmentContract: String,
    contractChanges: String,
    notice: String,

    performanceEvaluations: String,
    disciplinary: String,
    futureDevelopmentPlans: String,

    access: String,
    security: String,


    profileImage: {
      type: fileSchema,
      default: null,
    },
    childrens: [
      {
        name: String,
        gender: String,
        dateOfBirth: Date,
      }
    ],
    documents: {
      idImages: {
        type: [fileSchema],
        default: [],
      },
      aadhaarImages: {
        type: [fileSchema],
        default: [],
      },
    },
  },
  { _id: false }
);


const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    phone: {
      type: String,
    },
    profilePic: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: null,
    },
    isApproved: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "banned"]
      },
      default: "pending",
      index: true,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    employeeProfile: {
      type: employeeProfileSchema,
      default: null,
    },

    otp: {
      type: String,
      select: false
    },
    otpExpiry: {
      type: Date,
      select: false
    },
    token: {
      type: String,
      select: false
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
