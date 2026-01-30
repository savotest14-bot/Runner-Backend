const mongoose = require("mongoose");

const sequenceSchema = new mongoose.Schema({
  key: {
    type: String, // invoice, reference
    required: true,
    unique: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Sequence", sequenceSchema);
