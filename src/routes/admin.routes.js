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

// =========================
// REVENUE BREAKDOWN
// =========================
router.get('/revenue', async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        let dateFilter = '';
        if (period === 'today') {
            dateFilter = "AND DATE(created_at) = CURRENT_DATE";
        } else if (period === 'week') {
            dateFilter = "AND created_at >= NOW() - INTERVAL '7 days'";
        } else if (period === 'month') {
            dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'";
        }
        
        // Get swap revenue (1% fee)
        const swapResult = await db.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(amount * 0.01), 0) as revenue, COALESCE(SUM(amount), 0) as volume
            FROM transactions 
            WHERE type = 'swap' AND status = 'completed' ${dateFilter}
        `);
        
        // Get withdrawal revenue (2% fee)
        const withdrawalResult = await db.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(amount * 0.02), 0) as revenue, COALESCE(SUM(amount), 0) as volume
            FROM transactions 
            WHERE type IN ('withdraw', 'withdrawal') AND status = 'completed' ${dateFilter}
        `);
        
        // Get deposit count
        const depositResult = await db.query(`
            SELECT COUNT(*) as count
            FROM transactions 
            WHERE type = 'deposit' AND status = 'completed' ${dateFilter}
        `);
        
        const swapRevenue = parseFloat(swapResult.rows[0].revenue);
        const withdrawalRevenue = parseFloat(withdrawalResult.rows[0].revenue);
        
        res.json({
            status: 'success',
            data: {
                swapRevenue,
                swapCount: parseInt(swapResult.rows[0].count),
                withdrawalRevenue,
                withdrawalCount: parseInt(withdrawalResult.rows[0].count),
                depositCount: parseInt(depositResult.rows[0].count),
                totalRevenue: swapRevenue + withdrawalRevenue,
                totalVolume: parseFloat(swapResult.rows[0].volume) + parseFloat(withdrawalResult.rows[0].volume),
                period
            }
        });
    } catch (error) {
        console.error('Revenue breakdown error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load revenue data'
        });
    }
});

router.post('/rates/manual', async (req, res) => {
    try {
        const { ngnToKsh, kshToNgn, enabled } = req.body;
        
        if (enabled === false) {
            // Disable manual mode - delete manual rate records
            await db.query(`
                DELETE FROM exchange_rates 
                WHERE manual_override = true
            `);
            
            console.log('✅ Manual rate mode disabled by admin');
            
            return res.json({
                status: 'success',
                message: 'Manual mode disabled, API rates restored'
            });
        }
        
        // Enable manual mode
        if (!ngnToKsh || !kshToNgn) {
            return res.status(400).json({
                status: 'error',
                message: 'Both rates are required'
            });
        }
        
        // Delete any existing manual rates
        await db.query(`
            DELETE FROM exchange_rates 
            WHERE manual_override = true
        `);
        
        // Insert new manual rates
        await db.query(`
            INSERT INTO exchange_rates (from_currency, to_currency, rate, manual_override, created_at)
            VALUES 
                ('NGN', 'KSH', $1, true, NOW()),
                ('KSH', 'NGN', $2, true, NOW())
        `, [ngnToKsh, kshToNgn]);
        
        console.log(`✅ Manual rates set by admin: NGN→KSH=${ngnToKsh}, KSH→NGN=${kshToNgn}`);
        
        res.json({
            status: 'success',
            message: 'Manual rates saved successfully',
            data: { ngnToKsh, kshToNgn }
        });
    } catch (error) {
        console.error('Manual rate error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to save manual rates'
        });
    }
});

// =========================
// USER WALLET & TRANSACTIONS
// =========================
router.get('/users/:userId/wallets', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await db.query(
            'SELECT currency, balance FROM wallets WHERE user_id = $1',
            [userId]
        );
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Get user wallets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get user wallets'
        });
    }
});

router.get('/users/:userId/transactions', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await db.query(
            `SELECT * FROM transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 20`,
            [userId]
        );
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Get user transactions error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get user transactions'
        });
    }
});

// =========================
// PLATFORM SETTINGS
// =========================
router.get('/settings', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM platform_settings LIMIT 1');
        
        if (result.rows.length > 0) {
            res.json({
                status: 'success',
                data: result.rows[0]
            });
        } else {
            // Return defaults if no settings exist
            res.json({
                status: 'success',
                data: {
                    transactionFee: 1,
                    withdrawalFee: 2,
                    minDeposit: 1000,
                    minWithdrawal: 100
                }
            });
        }
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get settings'
        });
    }
});

router.post('/settings', async (req, res) => {
    try {
        const { transactionFee, withdrawalFee, minDeposit, minWithdrawal } = req.body;
        
        // Check if settings exist
        const existing = await db.query('SELECT id FROM platform_settings LIMIT 1');
        
        if (existing.rows.length > 0) {
            // Update existing
            await db.query(
                `UPDATE platform_settings 
                 SET transaction_fee = $1, 
                     withdrawal_fee = $2, 
                     min_deposit = $3, 
                     min_withdrawal = $4,
                     updated_at = NOW()
                 WHERE id = $5`,
                [transactionFee, withdrawalFee, minDeposit, minWithdrawal, existing.rows[0].id]
            );
        } else {
            // Insert new
            await db.query(
                `INSERT INTO platform_settings (transaction_fee, withdrawal_fee, min_deposit, min_withdrawal)
                 VALUES ($1, $2, $3, $4)`,
                [transactionFee, withdrawalFee, minDeposit, minWithdrawal]
            );
        }
        
        console.log(`✅ Settings updated: Fee=${transactionFee}%, Withdrawal=${withdrawalFee}%, MinDeposit=₦${minDeposit}, MinWithdrawal=KSh${minWithdrawal}`);
        
        res.json({
            status: 'success',
            message: 'Settings updated successfully'
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update settings'
        });
    }
});

console.log('✅ Admin routes loaded successfully with secure middleware');

module.exports = router;
