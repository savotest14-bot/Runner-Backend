const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    propertyName: {
      type: String,
      required: true,
    },
    propertyType: {
      type: String,
      enum: ["house", "apartment", "commercial", "residential", "other"],
    },
    description: String,

    sizeSqm: Number,
    noOfResidents: Number,

    specialFeatureEndDate: Date,

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Property", propertySchema);
