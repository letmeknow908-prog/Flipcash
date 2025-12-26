const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const flutterwaveService = require('../services/flutterwave.service');

// GET /api/v1/rates - Get LIVE exchange rates
router.get('/', async (req, res) => {
    try {
        const ratesResult = await flutterwaveService.getExchangeRates();
        
        if (ratesResult.success) {
            res.status(200).json({
                status: 'success',
                data: ratesResult.data
            });
        } else {
            // Fallback to default rates
            res.status(200).json({
                status: 'success',
                data: {
                    ngnToKsh: 0.18,
                    kshToNgn: 5.5,
                    lastUpdated: new Date().toISOString(),
                    fallback: true
                }
            });
        }
    } catch (error) {
        console.error('Get rates error:', error);
        res.status(200).json({
            status: 'success',
            data: {
                ngnToKsh: 0.18,
                kshToNgn: 5.5,
                lastUpdated: new Date().toISOString(),
                fallback: true
            }
        });
    }
});

// POST /api/v1/rates/account/generate - Generate REAL virtual account
router.post('/account/generate', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = require('../../config/db');
        
        // Get user data
        const userResult = await db.query(
            'SELECT first_name, last_name, email, phone, kyc_status, kyc_verified FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
        
        const user = userResult.rows[0];
        
        // Check KYC status
        if (user.kyc_status !== 'approved' || !user.kyc_verified) {
            return res.status(403).json({
                status: 'error',
                message: 'KYC verification required. Please complete KYC to generate virtual account.'
            });
        }
        
        // Check if account already exists
        const existingAccount = await db.query(
            'SELECT account_number, account_name, bank FROM virtual_accounts WHERE user_id = $1',
            [userId]
        );
        
        if (existingAccount.rows.length > 0) {
            return res.status(200).json({
                status: 'success',
                data: {
                    accountNumber: existingAccount.rows[0].account_number,
                    accountName: existingAccount.rows[0].account_name,
                    bank: existingAccount.rows[0].bank
                }
            });
        }
        
        // Get BVN from KYC data
        const kycResult = await db.query(
            'SELECT bvn FROM kyc_data WHERE user_id = $1',
            [userId]
        );
        
        if (kycResult.rows.length === 0 || !kycResult.rows[0].bvn) {
            return res.status(400).json({
                status: 'error',
                message: 'BVN is required to generate virtual account. Please update your KYC information.'
            });
        }
        
        // Create virtual account with Flutterwave
        const accountResult = await flutterwaveService.createVirtualAccount({
            userId: userId,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            bvn: kycResult.rows[0].bvn
        });
        
        if (accountResult.success) {
            // Save to database
            await db.query(
                `INSERT INTO virtual_accounts 
                 (user_id, account_number, account_name, bank, flw_ref, order_ref) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    userId,
                    accountResult.data.accountNumber,
                    accountResult.data.accountName,
                    accountResult.data.bank,
                    accountResult.data.flwRef,
                    accountResult.data.orderRef
                ]
            );
            
            return res.status(200).json({
                status: 'success',
                data: {
                    accountNumber: accountResult.data.accountNumber,
                    accountName: accountResult.data.accountName,
                    bank: accountResult.data.bank
                }
            });
        } else {
            return res.status(500).json({
                status: 'error',
                message: accountResult.error || 'Failed to generate virtual account. Please contact support.'
            });
        }
        
    } catch (error) {
        console.error('❌ Generate account error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate account. Please try again or contact support.'
        });
    }
});

// Test route
router.get('/test', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'Rate routes are working!',
        flutterwaveConnected: !!process.env.FLW_SECRET_KEY
    });
});

console.log('✅ Rate routes loaded');
module.exports = router;
