const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
    {
        fileName: { type: String, trim: true },
        fileUrl: { type: String, trim: true },
        uploadedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const contractSchema = new mongoose.Schema(
    {
        contractNumber: {
            type: String,
            required: true,
        },
        invoiceNumber: {
            type: String,
        },
        referenceNumber: {
            type: String
        },
        contractType: {
            type: String,
            enum: ["one-time", "long-term"],
            required: true,
        },

        startDate: {
            type: Date,
            required: true,
        },

        endDate: {
            type: Date,
            required: true,
        },

        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true,
        },

        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
            required: true,
        },

        tasks: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Task",
            },
        ],

        totalTasks: Number,
        totalTimeDays: Number,

        totalCost: {
            type: Number,
            required: true,
        },

        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        additionalDocuments: {
            type: [fileSchema],
            default: [],
        },
        status: {
            type: String,
            enum: ["draft", "active", "completed", "cancelled"],
            default: "draft",
        },
        clinetStatus: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },
        emailTemplateCode: String,
        emailTheme: String,
        emailStatus: {
            type: String,
            enum: ["pending", "sent", "accepted", "rejected"],
            default: "pending"
        },
        rejectionReason: String,
        emailRespondedAt: Date,
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Contract", contractSchema);
