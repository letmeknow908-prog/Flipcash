const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/auth.controller');
const { validationRules, validate } = require('../middleware/validation');

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many requests from this IP, please try again later.',
});

const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 OTP requests per minute
  message: 'Too many OTP requests, please try again later.',
});

// Routes
router.post('/register', 
  authLimiter,
  validate(validationRules.register), 
  AuthController.register
);

router.post('/verify-otp', 
  validate(validationRules.verifyOTP), 
  AuthController.verifyOTP
);

router.post('/resend-otp', 
  otpLimiter,
  validate(validationRules.resendOTP), 
  AuthController.resendOTP
);

router.post('/login', 
  authLimiter,
  validate(validationRules.login), 
  AuthController.login
);

router.post('/refresh', 
  validate(validationRules.refreshToken), 
  AuthController.refreshToken
);

router.post('/logout', 
  AuthController.logout
);

router.post('/forgot-password', 
  authLimiter,
  validate(validationRules.forgotPassword), 
  AuthController.forgotPassword
);

router.post('/reset-password', 
  validate(validationRules.resetPassword), 
  AuthController.resetPassword
);

module.exports = router;
