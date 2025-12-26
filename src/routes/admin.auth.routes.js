const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/admin.auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Admin registration (for initial setup - can be protected later)
router.post('/register', adminAuthController.registerAdmin);

// Admin login (SEPARATE from user login)
router.post('/login', adminAuthController.adminLogin);

// Verify admin token
router.get('/verify', authMiddleware, adminAuthController.verifyAdmin);

console.log('✅ Admin auth routes loaded');

module.exports = router;
