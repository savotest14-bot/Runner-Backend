const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { uploadContractFiles } = require("../middlewares/employeeUploads"); 
const { getAllClientsForCompanyAdmin, getAllPropertiesForCompanyAdmin, getTemplatesForAdmin, updateCompanyLogo, getCompanyAdminDashboard } = require("../controllers/companyAdmin");
const { uploadCompanyLogo } = require("../middlewares/uploads");
const { getAllWorkReports, getWorkReportDetails, approveWorkReport, updateWorkReport, sendInvoice, getAllInvoices, getInvoiceById } = require("../controllers/common");


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

router.get("/getCompanyAdminDashboard", authenticate, getCompanyAdminDashboard);

router.get("/getAllWorkReports", authenticate, getAllWorkReports);

router.get("/getWorkReportDetails/:reportId", authenticate, getWorkReportDetails);

router.put("/updateWorkReport/:reportId", authenticate, updateWorkReport);

router.patch("/approveWorkReport/:reportId", authenticate, approveWorkReport);

router.get("/getAllInvoices", authenticate, getAllInvoices)

router.get("/getInvoiceById/:invoiceId", authenticate, getInvoiceById)

router.patch("/sendInvoice/:invoiceId", authenticate, sendInvoice)

module.exports = router;