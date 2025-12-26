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
        
        console.log('🏦 Virtual account generation request for user:', userId);
        
        // Check if user exists and has KYC approved
        const userResult = await db.query(`
            SELECT u.*, k.bvn, k.fullname
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
        
        console.log('👤 User details:', {
            id: user.id,
            email: user.email,
            kyc_status: user.kyc_status,
            has_bvn: !!user.bvn
        });
        
        // Check KYC status
        if (user.kyc_status !== 'approved') {
            return res.status(400).json({
                status: 'error',
                message: 'KYC must be approved before generating virtual account'
            });
        }
        
        // Check if BVN exists (required for production)
        if (!user.bvn) {
            return res.status(400).json({
                status: 'error',
                message: 'BVN is required to generate virtual account'
            });
        }
        
        // Check if account already exists
        const existingAccount = await db.query(
            'SELECT * FROM virtual_accounts WHERE user_id = $1',
            [userId]
        );
        
        if (existingAccount.rows.length > 0) {
            console.log('✅ Account already exists:', existingAccount.rows[0]);
            return res.json({
                status: 'success',
                data: {
                    accountNumber: existingAccount.rows[0].account_number,
                    accountName: existingAccount.rows[0].account_name,
                    bankName: existingAccount.rows[0].bank || 'Wema Bank',
                    message: 'Account already generated'
                }
            });
        }
        
        // Generate new account via Flutterwave
        console.log('📞 Calling Flutterwave API...');
        
        const accountData = {
            email: user.email,
            is_permanent: true,
            bvn: user.bvn,
            tx_ref: `FLIPCASH_${userId}_${Date.now()}`,
            firstname: user.first_name,
            lastname: user.last_name,
            narration: `FlipCash - ${user.first_name} ${user.last_name}`
        };
        
        console.log('📋 Request data:', { ...accountData, bvn: '***hidden***' });
        
        const result = await flutterwaveService.createVirtualAccount(accountData);
        
        console.log('📡 Flutterwave response:', {
            success: !!result.account_number,
            account_number: result.account_number,
            account_name: result.account_name,
            bank_name: result.bank_name,
            flw_ref: result.flw_ref,
            order_ref: result.order_ref
        });
        
        if (!result.account_number) {
            console.error('❌ No account number in response!');
            console.error('Full response:', JSON.stringify(result, null, 2));
            return res.status(500).json({
                status: 'error',
                message: 'Failed to generate account number. Please contact support.'
            });
        }
        
        // Save to database
        const saveResult = await db.query(`
            INSERT INTO virtual_accounts (
                user_id, account_number, account_name, bank, flw_ref, order_ref
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            userId,
            result.account_number,
            result.account_name,
            result.bank_name || 'Wema Bank',
            result.flw_ref || null,
            result.order_ref || null
        ]);
        
        console.log('✅ Virtual account saved to database:', saveResult.rows[0]);
        
        res.json({
            status: 'success',
            data: {
                accountNumber: result.account_number,
                accountName: result.account_name,
                bankName: result.bank_name || 'Wema Bank',
                message: 'Virtual account generated successfully'
            }
        });
        
    } catch (error) {
        console.error('❌ Virtual account generation error:', error);
        console.error('Error details:', error.response?.data || error.message);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate virtual account: ' + error.message
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
