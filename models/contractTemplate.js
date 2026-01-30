const mongoose = require("mongoose");

const contractTemplateSchema = new mongoose.Schema(
  {
    templateCode: {
      type: String, 
      required: true,
      unique: true,
    },

    templateName: {
      type: String, 
      required: true,
    },

    previewImage: {
      type: String, 
    },

    htmlBody: {
      type: String, 
      required: true,
    },

    active: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "contract_templates",
  contractTemplateSchema
);
