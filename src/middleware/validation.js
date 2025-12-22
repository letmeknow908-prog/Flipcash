const { body, validationResult } = require('express-validator');

// Validation rules
const validationRules = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('phone').matches(/^(\+254|0)[17]\d{8}$/).withMessage('Please provide a valid Kenyan phone number'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
  ],

  login: [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],

  verifyOTP: [
    body('userId').isUUID().withMessage('Invalid user ID'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
  ],

  resendOTP: [
    body('userId').isUUID().withMessage('Invalid user ID'),
  ],

  refreshToken: [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],

  forgotPassword: [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  ],

  resetPassword: [
    body('userId').isUUID().withMessage('Invalid user ID'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],

  swap: [
    body('fromCurrency').isIn(['NGN', 'KSH', 'BTC', 'ETH', 'USDT']).withMessage('Invalid source currency'),
    body('toCurrency').isIn(['NGN', 'KSH', 'BTC', 'ETH', 'USDT']).withMessage('Invalid target currency'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  ],

  withdraw: [
    body('currency').isIn(['KSH']).withMessage('Only KSH withdrawals are supported'),
    body('amount').isFloat({ min: 100 }).withMessage('Minimum withdrawal amount is KSH 100'),
    body('phoneNumber').matches(/^(\+254|0)[17]\d{8}$/).withMessage('Please provide a valid Kenyan phone number'),
    body('provider').isIn(['mpesa', 'airtel']).withMessage('Invalid provider'),
  ],
};

// Validation handler
const validate = (rules) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(rules.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg,
        })),
      });
    }

    next();
  };
};

module.exports = {
  validationRules,
  validate,
};
