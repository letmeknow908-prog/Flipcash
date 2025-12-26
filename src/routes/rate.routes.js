const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');

// Try to load controller
let rateController;
try {
    rateController = require('../controllers/rate.controller');
} catch (error) {
    console.error('⚠️ rate.controller not found:', error.message);
    // Fallback controller with default rates
    rateController = {
        getRates: (req, res) => {
            res.status(200).json({
                status: 'success',
                data: {
                    ngnToKsh: 0.18,
                    kshToNgn: 5.5,
                    lastUpdated: new Date().toISOString()
                }
            });
        }
    };
}

// GET /api/v1/rates - Get exchange rates
router.get('/', rateController.getRates);

// ✅ ADD THIS - Generate virtual account
router.post('/account/generate', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = require('../../config/db');
        
        // Check if user has KYC approved
        const userResult = await db.query(
            'SELECT kyc_status, kyc_verified FROM users WHERE id = $1',
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
            'SELECT account_number, account_name FROM virtual_accounts WHERE user_id = $1',
            [userId]
        );
        
        if (existingAccount.rows.length > 0) {
            return res.status(200).json({
                status: 'success',
                data: {
                    accountNumber: existingAccount.rows[0].account_number,
                    accountName: existingAccount.rows[0].account_name,
                    bank: 'Wema Bank'
                }
            });
        }
        
        // Generate new account number (10 digits starting with 9)
        const accountNumber = '9' + Math.random().toString().slice(2, 11);
        const accountName = req.body.firstName + ' ' + req.body.lastName;
        
        // Save to database
        await db.query(
            'INSERT INTO virtual_accounts (user_id, account_number, account_name, bank) VALUES ($1, $2, $3, $4)',
            [userId, accountNumber, accountName, 'Wema Bank']
        );
        
        res.status(200).json({
            status: 'success',
            data: {
                accountNumber: accountNumber,
                accountName: accountName,
                bank: 'Wema Bank'
            }
        });
    } catch (error) {
        console.error('Generate account error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate account'
        });
    }
});

// Test route
router.get('/test', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'Rate routes are working!',
        currentRates: {
            ngnToKsh: 0.18,
            kshToNgn: 5.5
        }
    });
});

console.log('✅ Rate routes loaded');
module.exports = router;
