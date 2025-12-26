const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminMiddleware = require('../middleware/admin.middleware');
const db = require('../../config/db');  // ✅ ADD THIS
const flutterwaveService = require('../services/flutterwave.service');  // ✅ ADD THIS

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
router.post('/kyc/:userId/verify-bvn', async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log('🔍 Admin verifying BVN for user:', userId);
        
        // Get user and KYC data
        const userResult = await db.query(`
            SELECT u.*, k.bvn, k.fullname, k.dob
            FROM users u
            LEFT JOIN kyc_data k ON u.id = k.user_id
            WHERE u.id = $1
        `, [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
        
        const user = userResult.rows[0];
        
        if (!user.bvn) {
            return res.status(400).json({
                status: 'error',
                message: 'No BVN found for this user'
            });
        }
        
        // Split fullname into first and last name
        const nameParts = user.fullname.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || nameParts[0];
        
        console.log('🔍 Verifying BVN:', { 
            bvn: user.bvn.substring(0, 3) + '****', 
            firstName, 
            lastName 
        });
        
        // Call Flutterwave BVN verification
        const verificationResult = await flutterwaveService.verifyBVN(
            user.bvn,
            firstName,
            lastName,
            user.dob
        );
        
        // Save verification result to database
        await db.query(`
            UPDATE kyc_data 
            SET 
                bvn_verified = $1,
                bvn_verification_data = $2
            WHERE user_id = $3
        `, [
            verificationResult.success,
            JSON.stringify(verificationResult.bvnData),
            userId
        ]);
        
        console.log('✅ BVN verification completed:', verificationResult);
        
        if (verificationResult.success) {
            res.json({
                status: 'success',
                message: 'BVN verification completed',
                data: {
                    match: verificationResult.match,
                    userFirstName: firstName,
                    userLastName: lastName,
                    bvnFirstName: verificationResult.bvnData?.firstName,
                    bvnLastName: verificationResult.bvnData?.lastName,
                    verified: true
                }
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: verificationResult.error || 'BVN verification failed',
                data: {
                    verified: false
                }
            });
        }
    } catch (error) {
        console.error('❌ BVN verification route error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to verify BVN: ' + error.message
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
