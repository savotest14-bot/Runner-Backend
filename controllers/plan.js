const mongoose = require("mongoose");
const Company = require("../models/company");
const Plan = require("../models/plan");
const Subscription = require("../models/subscription");

exports.createPlan = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const {
      planName,
      monthlyFees,
      annualFees,
      sequence,
      planDescription,
      planFeatures = [],
      employeeLimit,
    } = req.body;

    if (
      !planName ||
      monthlyFees == null ||
      annualFees == null ||
      sequence == null ||
      employeeLimit == null
    ) {
      return res.status(400).json({
        message:
          "planName, monthlyFees, annualFees, sequence and employeeLimit are required",
      });
    }

    // 🔎 Check if plan exists
    let plan = await Plan.findOne({
      planName: planName.trim(),
      isDeleted: false,
    });

    // ✅ IF EXISTS → UPDATE
    if (plan) {
      plan.monthlyFees = monthlyFees;
      plan.annualFees = annualFees;
      plan.sequence = sequence;
      plan.employeeLimit = employeeLimit;
      plan.planDescription = planDescription;
      plan.planFeatures = planFeatures;
      plan.updatedBy = req.user._id;

      await plan.save();

      return res.status(200).json({
        success: true,
        message: "Plan updated successfully",
        data: plan,
      });
    }

    // ✅ IF NOT EXISTS → CREATE
    plan = await Plan.create({
      planName: planName.trim(),
      monthlyFees,
      annualFees,
      sequence,
      employeeLimit,
      planDescription,
      planFeatures,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      data: plan,
    });
  } catch (error) {
    console.error("Create/Update plan error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Sequence already exists",
      });
    }

    return res.status(500).json({
      message: "Failed to process plan",
    });
  }
};



exports.togglePlanStatus = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const plan = await Plan.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!plan) {
      return res.status(404).json({
        message: "Plan not found",
      });
    }

    plan.planStatus = plan.planStatus === "active" ? "inactive" : "active";
    await plan.save();

    return res.status(200).json({
      success: true,
      message: `Plan ${plan.planStatus} successfully`,
      data: {
        id: plan._id,
        planStatus: plan.planStatus,
      },
    });
  } catch (error) {
    console.error("Toggle plan status error:", error);
    return res.status(500).json({
      message: "Failed to toggle plan status",
    });
  }
};


exports.softDeletePlan = async (req, res) => {
  try {
    if (req.user.role.name !== "superAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const plan = await Plan.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!plan) {
      return res.status(404).json({
        message: "Plan not found",
      });
    }

    const planInUse = await Company.exists({
      planId: plan._id,
      isDeleted: false,
    });

    if (planInUse) {
      return res.status(409).json({
        message: "Plan is currently assigned to companies and cannot be deleted",
      });
    }

    plan.isDeleted = true;
    plan.planStatus = "inactive";
    await plan.save();

    return res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("Delete plan error:", error);
    return res.status(500).json({
      message: "Failed to delete plan",
    });
  }
};


exports.getAllPlans = async (req, res) => {
  try {
    const role = req.user?.role?.name;
    
    if (!["superAdmin", "company_admin"].includes(role)) {
      return res
        .status(403)
        .json({ message: "You dont have permission to access this route" });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const search = req.query.search?.trim();

    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: false,
    };

    if (role === "company_admin") {
      filter.planStatus = "active";
    }

    if (search) {
      filter.planName = { $regex: search, $options: "i" };
    }

    const [plans, total] = await Promise.all([
      Plan.find(filter)
        .sort({ sequence: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Plan.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: plans,
    });
  } catch (error) {
    console.error("Get all plans error:", error);
    return res.status(500).json({
      message: "Failed to fetch plans",
    });
  }
};



exports.purchasePlan = async (req, res) => {
  try {
    const user = req.user;

    if (user.role.name !== "company_admin") {
      return res.status(403).json({
        message: "Only company admin can purchase plans",
      });
    }

    const { planId, billingCycle } = req.body;

    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    if (!["monthly", "yearly"].includes(billingCycle)) {
      return res.status(400).json({
        message: "billingCycle must be monthly or yearly",
      });
    }

    const company = await Company.findOne({
      _id: user.company,
      isDeleted: false,
    });

    if (!company) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    if (
      company.subscriptionStatus === "active" &&
      company.subscriptionEndDate &&
      company.subscriptionEndDate > new Date()
    ) {
      return res.status(409).json({
        message: "Company already has an active subscription",
      });
    }

    const plan = await Plan.findOne({
      _id: planId,
      planStatus: "active",
      isDeleted: false,
    });

    if (!plan) {
      return res.status(404).json({
        message: "Plan not found or inactive",
      });
    }

    const amount =
      billingCycle === "yearly"
        ? plan.annualFees
        : plan.monthlyFees;

    const startDate = new Date();

    const endDate =
      billingCycle === "yearly"
        ? new Date(new Date(startDate).setFullYear(startDate.getFullYear() + 1))
        : new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));


    const subscription = await Subscription.create({
      company: company._id,
      plan: plan._id,
      billingCycle,
      amount,
      startDate,
      endDate,
      status: "active",
      createdBy: user._id,
    });

    company.planId = plan._id;
    company.subscriptionId = subscription._id;
    company.subscriptionAmount = amount;
    company.subscriptionStartDate = startDate;
    company.subscriptionEndDate = endDate;
    company.subscriptionStatus = "active";
    company.paymentFrequency = billingCycle;

    await company.save();

    return res.status(201).json({
      success: true,
      message: "Plan purchased successfully (payment mocked)",
      data: {
        plan: plan.planName,
        billingCycle,
        amount,
        startDate,
        endDate,
        subscriptionId: subscription._id,
      },
    });
  } catch (error) {
    console.error("Purchase plan error:", error);
    return res.status(500).json({
      message: "Failed to purchase plan",
    });
  }
};
