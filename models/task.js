const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        taskName: {
            type: String,
            required: true,
        },

        taskCategory: String,
        taskSubCategory: String,

        taskDuration: {
            type: Number,
            required: true,
            min: 1
        },

        taskDurationUnit: {
            type: String,
            enum: ["years", "months", "days", "hours", "minutes", "seconds"],
            required: true
        },
        taskPrice: {
            type: Number,
            default: 0
        },
        timerStartedAt: Date,
        timerCompletedAt: Date,
        taskEndAt: Date,

        status: {
            type: String,
            enum: ["pending", "in_progress", "completed"],
            default: "pending",
        },

        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },

        assignedTo: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],

        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);


module.exports = mongoose.model("Task", taskSchema);
