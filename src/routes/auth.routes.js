const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// POST /api/v1/auth/register - Register new user
router.post('/register', authController.register);

// POST /api/v1/auth/login - Login user
router.post('/login', authController.login);

// POST /api/v1/auth/forgot-password - Request password reset
router.post('/forgot-password', authController.forgotPassword);

// GET /api/v1/auth/me - Get current user (protected)
// router.get('/me', authMiddleware, authController.getCurrentUser);

console.log('✅ Auth routes loaded');

module.exports = router;
