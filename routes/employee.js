const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const { uploadEmployeeImages } = require("../middlewares/employeeUploads");
const { createEmployee, getAllEmployees, getEmployeeById, updateEmployee, toggleEmployeeDeleteByCompanyAdmin } = require("../controllers/employee");
const authorize = require("../middlewares/authorize");

router.post(
    "/create",
    authenticate,
    authorize("create_user"),
    uploadEmployeeImages,
    createEmployee
);

router.get(
  "/getAllEmployees",
  authenticate,
  authorize("view_user"),
  getAllEmployees
);

router.get(
  "/getEmployeeById/:employeeId",
  authenticate,
  authorize("view_user"),
  getEmployeeById
);

router.put(
  "/update/:employeeId",
  authenticate,
  authorize("update_user"),
  uploadEmployeeImages,
  updateEmployee
);

router.patch(
  "/delete/:id",
  authenticate,
  authorize("manage_employees"),
  toggleEmployeeDeleteByCompanyAdmin
);


module.exports = router;