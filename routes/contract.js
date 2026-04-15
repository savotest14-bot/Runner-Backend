const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const { createContractByCompanyAdmin, getCompanyAdminContracts, getSingleCompanyAdminContract, contractEmailResponse} = require("../controllers/contract");
const { uploadContractFiles } = require("../middlewares/employeeUploads");

router.post("/createContract", authenticate, authorize("create_contract"), uploadContractFiles,  createContractByCompanyAdmin);
router.get("/getAllContracts", authenticate, authorize("view_contracts"), getCompanyAdminContracts);
router.get("/getContractById/:id", authenticate, authorize("view_contracts"), getSingleCompanyAdminContract);

router.get("/respond",  contractEmailResponse);

module.exports = router; 