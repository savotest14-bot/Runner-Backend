const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { getAllTasksForCompanyAdmin, getTaskByIdForCompanyAdmin } = require("../controllers/task");


router.get(
  "/getAllTasks",
  authenticate,
  authorize("view_tasks"),
  getAllTasksForCompanyAdmin
);

router.get(
  "/getTask/:taskId",
  authenticate,
  authorize("view_tasks"),
  getTaskByIdForCompanyAdmin
);

module.exports = router;