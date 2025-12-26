const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminMiddleware = require('../middleware/admin.middleware');  // Use admin middleware!

console.log('📊 Loading admin routes...');

// Dashboard stats
router.get('/stats', adminMiddleware, adminController.getDashboardStats);

// KYC Management
router.get('/kyc', adminMiddleware, adminController.getAllKYC);
router.get('/kyc/:userId', adminMiddleware, adminController.getKYCDetails);
router.put('/kyc/:userId/approve', adminMiddleware, adminController.approveKYC);
router.put('/kyc/:userId/reject', adminMiddleware, adminController.rejectKYC);

// User Management
router.get('/users', adminMiddleware, adminController.getAllUsers);
router.get('/users/:userId', adminMiddleware, adminController.getUserDetails);
router.put('/users/:userId/block', adminMiddleware, adminController.blockUser);
router.put('/users/:userId/unblock', adminMiddleware, adminController.unblockUser);

// Transaction Management
router.get('/transactions', adminMiddleware, adminController.getAllTransactions);

console.log('✅ Admin routes loaded successfully with secure middleware');

module.exports = router;
