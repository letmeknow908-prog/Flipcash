const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminMiddleware = require('../middleware/admin.middleware');

console.log('📊 Loading admin routes...');

// Apply admin middleware to ALL routes
router.use(adminMiddleware);

// =========================
// DASHBOARD STATS
// =========================
router.get('/stats', adminController.getDashboardStats);

// =========================
// KYC MANAGEMENT
// =========================
router.get('/kyc', adminController.getAllKYC);
router.get('/kyc/:userId', adminController.getKYCDetails);

// FIXED: Changed from PUT to POST (frontend uses POST!)
router.post('/kyc/:userId/approve', adminController.approveKYC);
router.post('/kyc/:userId/reject', adminController.rejectKYC);

// =========================
// USER MANAGEMENT
// =========================
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/block', adminController.blockUser);
router.put('/users/:userId/unblock', adminController.unblockUser);

// =========================
// TRANSACTION MANAGEMENT
// =========================
router.get('/transactions', adminController.getAllTransactions);

console.log('✅ Admin routes loaded successfully with secure middleware');

module.exports = router;
