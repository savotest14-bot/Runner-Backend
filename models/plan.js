const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    monthlyFees: {
      type: Number,
      required: true,
      min: 0,
    },

    annualFees: {
      type: Number,
      required: true,
      min: 0,
    },

    planStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    planDescription: {
      type: String,
      trim: true,
    },
    sequence: {
      type: Number,
      required: true,
      unique: true,
    },
    employeeLimit: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    planFeatures: [
      {
        type: String,
        trim: true,
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Plan || mongoose.model("Plan", planSchema);

