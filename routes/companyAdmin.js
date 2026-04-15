const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { uploadContractFiles } = require("../middlewares/employeeUploads"); 
const { getAllClientsForCompanyAdmin, getAllPropertiesForCompanyAdmin, getTemplatesForAdmin, updateCompanyLogo } = require("../controllers/companyAdmin");
const { uploadCompanyLogo } = require("../middlewares/uploads");


// Clients

router.get("/getAllClients", authenticate, authorize("view_contracts"), getAllClientsForCompanyAdmin);

// Property

router.get(
  "/getAllProperties",
  authenticate,
  authorize("view_properties"),
  getAllPropertiesForCompanyAdmin
);

router.get(
  "/getTemplates",
  authenticate,
  authorize("view_templates"),
  getTemplatesForAdmin
);

router.put(
  "/uploadCompanyLogo/:id",
  authenticate,
  uploadCompanyLogo,
  updateCompanyLogo
);

module.exports = router;