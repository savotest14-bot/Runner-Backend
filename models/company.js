const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
   logo:{
      type: String,
      default: null
   },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },

    phoneCode: {
      type: String,
      default: "+91",
    },

    phoneNumber: {
      type: String,
      trim: true,
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },

    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },

    subscriptionAmount: {
      type: Number,
      default: 0,
    },

    subscriptionStartDate: {
      type: Date,
      default: null,
    },

    subscriptionEndDate: {
      type: Date,
      default: null,
    },
    subscriptionStatus: {
      type: String,
      enum: ["pending", "active", "expired", "banned", "rejected"],
      default: "pending",
    },
    paymentFrequency: {
      type: String,
      enum: ["monthly", "yearly"],
      default: null,
    },
    paymentId: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    licenseNo: {
      type: String,
      trim: true,
    },
     isApproved: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "banned"]
      },
      default: "pending",
      index: true,
    },
    licenseExpiryDate: {
      type: Date,
      default: null,
    },

    licenseDocuments: [
      {
        fileName: String,
        fileUrl: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    currentEmployeeCount: {
      type: Number,
      default: 0,
      min: 0
    },
    address: addressSchema,

    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active",
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Company ||
  mongoose.model("Company", companySchema);
