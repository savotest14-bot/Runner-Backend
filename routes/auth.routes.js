const express = require("express");
const router = express.Router();
const { login, companyAdminSignup, forgotPassword, forgotVerifyOTP, resetPassword, logout, getRoles, resendOtp } = require("../controllers/auth.controller");
const {
  uploadLicenseDocs,
} = require("../middlewares/uploads");
const {
  userLogin,
  emailValidation,
  verifyOTPValidation,
  resetPasswordValidation
} = require("../validations/validator");
const validate = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");


router.post("/login", validate(userLogin), login);
router.post('/forgot-password', validate(emailValidation), forgotPassword);
router.post('/forgot-verify-otp/:id', validate(verifyOTPValidation), forgotVerifyOTP);
router.post('/reset-password/:token', validate(resetPasswordValidation), resetPassword);
router.post("/logout", logout);
router.get("/getRole", authenticate, getRoles);
router.post("/resendOtp", authenticate, resendOtp);
router.post("/signup/company-admin", uploadLicenseDocs, companyAdminSignup);

module.exports = router;
