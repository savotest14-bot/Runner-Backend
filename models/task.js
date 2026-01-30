const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        taskName: {
            type: String,
            required: true,
        },

        taskCategory: String,
        taskSubCategory: String,

        taskTime: {
            type: Number, 
        },

        taskPrice: {
            type: Number,
        },

        description: String,

        dueDate: Date,

        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        assignedTo: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        status: {
            type: String,
            enum: ["pending", "in_progress", "completed"],
            default: "pending",
        },

        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
