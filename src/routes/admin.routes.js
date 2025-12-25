const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');

console.log('📊 Loading admin routes...');

// Dashboard stats
router.get('/stats', authMiddleware, adminController.getDashboardStats);

// KYC Management
router.get('/kyc', authMiddleware, adminController.getAllKYC);
router.get('/kyc/:userId', authMiddleware, adminController.getKYCDetails);
router.put('/kyc/:userId/approve', authMiddleware, adminController.approveKYC);
router.put('/kyc/:userId/reject', authMiddleware, adminController.rejectKYC);

// User Management
router.get('/users', authMiddleware, adminController.getAllUsers);
router.get('/users/:userId', authMiddleware, adminController.getUserDetails);
router.put('/users/:userId/block', authMiddleware, adminController.blockUser);
router.put('/users/:userId/unblock', authMiddleware, adminController.unblockUser);

// Transaction Management
router.get('/transactions', authMiddleware, adminController.getAllTransactions);

console.log('✅ Admin routes loaded successfully');

module.exports = router;
