const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const kycController = require('../controllers/kyc.controller');

// Health check
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'User routes are working'
    });
});

// ✅ Get user profile (called by frontend as /users/me)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = require('../../config/db');
        
        console.log('🔍 Fetching user profile for ID:', userId);
        
        // Get user basic info
        const userResult = await db.query(
            'SELECT id, first_name, last_name, email, phone, kyc_status, kyc_verified, created_at FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
        
        const user = userResult.rows[0];
        console.log('👤 User found:', { id: user.id, email: user.email, kyc_status: user.kyc_status });
        
        // Get KYC data if exists (FIXED: changed kyc_verifications to kyc_data)
        const kycResult = await db.query(
            'SELECT fullname, dob, address, id_type, id_number, bvn, country, occupation, source_funds FROM kyc_data WHERE user_id = $1',
            [userId]
        );
        
        // Merge KYC data if exists
        if (kycResult.rows.length > 0) {
            console.log('📋 KYC data found:', { fullname: kycResult.rows[0].fullname });
            user.kyc_data = kycResult.rows[0];
            // Also add to top level for backward compatibility
            Object.assign(user, kycResult.rows[0]);
        } else {
            console.log('⚠️ No KYC data found for user');
        }
        
        console.log('✅ Returning user data with KYC status:', user.kyc_status);
        
        res.status(200).json({
            status: 'success',
            data: user
        });
    } catch (error) {
        console.error('❌ Get user profile error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get profile'
        });
    }
});

// Keep the old /profile endpoint for backward compatibility
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = require('../../config/db');
        
        const result = await db.query(
            'SELECT id, first_name, last_name, email, phone, kyc_status, kyc_verified, created_at FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
        
        res.status(200).json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get profile'
        });
    }
});

// KYC routes
router.post('/kyc/submit', authMiddleware, kycController.submitKYC);
router.get('/kyc/status', authMiddleware, kycController.getKYCStatus);

// Get user wallets
router.get('/wallets', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = require('../../config/db');
        
        const result = await db.query(
            'SELECT currency, balance, created_at FROM wallets WHERE user_id = $1',
            [userId]
        );
        
        res.status(200).json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Get wallets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get wallets'
        });
    }
});

// Get user transactions
router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = require('../../config/db');
        
        const result = await db.query(
            `SELECT * FROM transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [userId]
        );
        
        res.status(200).json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get transactions'
        });
    }
});

console.log('✅ User routes loaded');
module.exports = router;
