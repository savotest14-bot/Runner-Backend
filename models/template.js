const mongoose = require('mongoose');

const Schema = new mongoose.Schema({
    templateEvent: {
        type: String
    },
    active: {
        type: Boolean,
        default: true
    },
    subject: {
        type: String
    },
    mailVariables: {
        type: String
    },
    htmlBody: {
        type: String
    },
    textBody: {
        type: String
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId
    }
}, {
    timestamps: true,
});


module.exports = mongoose.model('template', Schema);