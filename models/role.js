const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    lowercase: true,
    unique: true,
  },

  scope: {
    type: String,
    enum: ["platform", "company", "group", "self"],
    required: true,
  },

  permissions: {
    type: [String],
    required: true,
  },
});

module.exports = mongoose.model("Role", roleSchema);
