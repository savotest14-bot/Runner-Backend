const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const {
  uploadLicenseDocs,
  uploadProfileImage,
} = require("../middlewares/uploads");

const {
  adminCreateCompany,
  getAllCompanies,
  getActiveSubscriptionCompanies,
  getPendingSubscriptionCompanies,
  getCompanyById,
  updateCompanyById,
  getAllEmployeesByCompany,
  getAllCompanyAdmins,
  getPendingCompanyAdmins,
  getApprovedCompanyAdmins,
  getSingleCompanyAdmin,
  updateCompanyAdmin,
  updateCompanyAdminProfilePic,
  toggleCompanyAndAllUsers,
  getAllUsersForSuperAdmin,
  getAllTasksForSuperAdmin,
  getAllClientsForSuperAdmin,
  getAllPropertiesForSuperAdmin,
  getTaskByIdForSuperAdmin,
  createRunnerEmployee,
  getAllRunnerEmployees,
  getRunnerEmployeeDetails,
  updateEmployee,
  getEmployeeById,
  updateCompanyStatus,
  getAllEmployeesforAssign,
  searchCompanies,
  getSuperAdminDashboard,
  getEmployeePayments,
  getAllDocuments,
} = require("../controllers/admin.controller");

const {
  createContract,
  getAllContracts,
  getSingleContractBySuperAdmin,
} = require("../controllers/contract");
const {
  uploadContractFiles,
  uploadEmployeeImages,
} = require("../middlewares/employeeUploads");
const { assignUsersToSubTask, removeUsersFromSubTask } = require("../controllers/task");
const { uploads } = require("../utils/upload");

/**Admin company Routes */

router.post(
  "/create-company",
  authenticate,
  authorize("create_company"),
  uploads.fields([
    { name: "licenseDocuments", maxCount: 5 },
    { name: "companyLogo", maxCount: 1 },
  ]),
  adminCreateCompany,
);

router.get(
  "/list-company",
  authenticate,
  authorize("view_company"),
  getAllCompanies,
);

router.get("/getCompanies", authenticate, authorize("view_company"), searchCompanies)
router.get(
  "/active-subscription-companies",
  authenticate,
  authorize("view_company"),
  getActiveSubscriptionCompanies,
);

router.get(
  "/pending-subscription-companies",
  authenticate,
  authorize("view_company"),
  getPendingSubscriptionCompanies,
);

router.get(
  "/companies/:companyId",
  authenticate,
  authorize("view_company"),
  getCompanyById,
);

router.put("/updateCompanyStatus/:companyId", authenticate,  authorize("update_company"), updateCompanyStatus);

router.put(
  "/companies/:companyId",
  authenticate,
  authorize("update_company"),
  uploadLicenseDocs,
  updateCompanyById,
);

router.get(
  "/employees/:companyId",
  authenticate,
  authorize("view_user"),
  getAllEmployeesByCompany,
);

router.get("/getEmployeeForAssign/:companyId", authenticate, getAllEmployeesforAssign);

/**Admin companyAdmin Routes */

router.get(
  "/getAllCompanyAdmins",
  authenticate,
  authorize("view_company_admins"),
  getAllCompanyAdmins,
);
router.get(
  "/getPendingCompanyAdmins",
  authenticate,
  authorize("view_company_admins"),
  getPendingCompanyAdmins,
);
router.get(
  "/getApprovedCompanyAdmins",
  authenticate,
  authorize("view_company_admins"),
  getApprovedCompanyAdmins,
);
router.get(
  "/getCompanyAdmin/:id",
  authenticate,
  authorize("view_company_admins"),
  getSingleCompanyAdmin,
);
router.put(
  "/updateCompanyAdmin/:id",
  authenticate,
  authorize("view_company_admins"),
  uploadLicenseDocs,
  updateCompanyAdmin,
);
router.put(
  "/updateCompanyAdminProfilePic/:id",
  authenticate,
  authorize("view_company_admins"),
  uploadProfileImage,
  updateCompanyAdminProfilePic,
);

router.patch(
  "/deleteCompanyAdmin/:id",
  authenticate,
  authorize("update_company_admins"),
  toggleCompanyAndAllUsers,
);

/**Admin contract Routes */

router.post(
  "/createContract",
  authenticate,
  authorize("create_contract"),
  uploadContractFiles,
  createContract,
);

router.get(
  "/getAllContracts",
  authenticate,
  authorize("view_contracts"),
  getAllContracts,
);
router.get(
  "/getContractById/:id",
  authenticate,
  authorize("view_contracts"),
  getSingleContractBySuperAdmin,
);

router.get(
  "/getAllUsers",
  authenticate,
  authorize("view_user"),
  getAllUsersForSuperAdmin,
);
router.get(
  "/getAllTask",
  authenticate,
  authorize("view_tasks"),
  getAllTasksForSuperAdmin,
);
router.get(
  "/getTask/:id",
  authenticate,
  getTaskByIdForSuperAdmin,
);

router.get(
  "/getAllClients",
  authenticate,
  authorize("view_client"),
  getAllClientsForSuperAdmin,
);

router.get(
  "/getAllProperties",
  authenticate,
  authorize("view_property"),
  getAllPropertiesForSuperAdmin,
);

router.post(
  "/create-runner-employee",
  authenticate,
  uploadEmployeeImages,
  createRunnerEmployee,
);
router.get("/runner-employees", authenticate, getAllRunnerEmployees);

router.get(
  "/runner-employee/:runnerId",
  authenticate,
  getRunnerEmployeeDetails,
);

router.put(
  "/runner-employee-update/:employeeId",
  authenticate,
  uploadEmployeeImages,
  updateEmployee,
);

router.get("/getEmployee/:employeeId", authenticate, getEmployeeById);

router.put("/assignUsers/:subTaskId", authenticate, assignUsersToSubTask);
router.put("/removeUsers/:subTaskId", authenticate, removeUsersFromSubTask);

router.get("/getSuperAdminDashboard", authenticate, getSuperAdminDashboard);

router.get("/getEmployeePayments", authenticate, getEmployeePayments);

router.get("/getAllDocuments", authenticate, getAllDocuments)

module.exports = router;
