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
router.post('/kyc/:userId/approve', adminController.approveKYC);
router.post('/kyc/:userId/reject', adminController.rejectKYC);

// Verify user's BVN before approving KYC
router.post('/kyc/:userId/verify-bvn', async (req, res) => {  // ✅ REMOVED adminAuthMiddleware
    try {
        const { userId } = req.params;
        const db = require('../../config/db');
        const flutterwaveService = require('../services/flutterwave.service');

        console.log('🔍 Admin verifying BVN for user:', userId);

        // Get user and KYC data
        const userResult = await db.query(
            `SELECT u.first_name, u.last_name, k.bvn, k.dob, k.fullname
             FROM users u
             JOIN kyc_data k ON u.id = k.user_id
             WHERE u.id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User or KYC data not found'
            });
        }

        const userData = userResult.rows[0];

        // Verify BVN with Flutterwave
        const verificationResult = await flutterwaveService.verifyBVN(
            userData.bvn,
            userData.first_name,
            userData.last_name,
            userData.dob
        );

        if (!verificationResult.success) {
            return res.status(400).json({
                status: 'error',
                message: 'BVN verification failed: ' + verificationResult.error
            });
        }

        // Save verification result
        await db.query(
            `UPDATE kyc_data 
             SET bvn_verified = $1,
                 bvn_verification_data = $2::jsonb,
                 updated_at = NOW()
             WHERE user_id = $3`,
            [
                verificationResult.data.match,
                JSON.stringify(verificationResult.data),
                userId
            ]
        );

        res.status(200).json({
            status: 'success',
            message: verificationResult.data.match ? 'BVN verified successfully' : 'BVN details do not match',
            data: {
                match: verificationResult.data.match,
                bvnFirstName: verificationResult.data.firstName,
                bvnLastName: verificationResult.data.lastName,
                userFirstName: userData.first_name,
                userLastName: userData.last_name
            }
        });

    } catch (error) {
        console.error('❌ BVN verification error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to verify BVN'
        });
    }
});

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
