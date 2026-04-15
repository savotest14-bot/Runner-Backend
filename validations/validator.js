const Joi = require("joi");

const userValidation = Joi.object({
  firstName: Joi.string().min(3).max(30).required().messages({
    "string.empty": "Please enter the first name",
    "string.min": "Name should be at least 3 characters",
    "string.max": "Name should not exceed 30 characters",
  }),
  lastName: Joi.string().min(3).max(30).required().messages({
    "string.empty": "Please enter the last name",
    "string.min": "Name should be at least 3 characters",
    "string.max": "Name should not exceed 30 characters",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Please enter the email",
    "string.email": "Please enter valid email",
  }),
  phoneNumber: Joi.string().required().messages({
    "string.empty": "Please enter the phone number",
    "string.phoneNumber": "Please enter valid phone number",
  }),
});

const verifyOTPValidation = Joi.object({
  otp: Joi.string().required().messages({
    "string.empty": "Please enter the otp",
  }),
});

const userLogin = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Please enter the email",
    "string.email": "Please enter valid email",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Please enter the password",
  }),
});

const emailValidation = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Please enter the email',
    'string.email': 'Please enter valid email',
  })
});

const resetPasswordValidation = Joi.object({
  newPassword: Joi.string()
    .pattern(
      new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$')
    )
    .required()
    .messages({
      'string.empty': 'Please enter the new password',
      'string.pattern.base':
        'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
    }),
  confirmPassword: Joi.string()
    .pattern(
      new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$')
    )
    .required()
    .messages({
      'string.empty': 'Please enter the confirm password',
      'string.pattern.base':
        'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
    }),
});

module.exports = { userValidation, verifyOTPValidation, userLogin, emailValidation, resetPasswordValidation };
