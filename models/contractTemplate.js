const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema({
  name: String,
  templateCode: String, // template_1, template_2 etc
  subject: String,
  html: String,
   themes: Object,
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });


module.exports = mongoose.model(
  "contract_templates",
  emailTemplateSchema
);
