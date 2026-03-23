const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const { createPlan, togglePlanStatus, softDeletePlan, getAllPlans, purchasePlan } = require("../controllers/plan");

router.post("/create", authenticate, authorize("create_plan"), createPlan);
router.patch("/toggle-status/:id", authenticate, authorize("update_plan"), togglePlanStatus);
router.delete("/delete/:id", authenticate, authorize("delete_plan"), softDeletePlan);
router.get("/getAllPlans", authenticate, authorize("view_plan"), getAllPlans);
router.post("/purchase-plan", authenticate, authorize("purchase_plan"), purchasePlan);
module.exports = router;