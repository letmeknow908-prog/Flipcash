const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const flutterwaveService = require('../services/flutterwave.service');
const db = require('../../config/db');

console.log('✅ Rate routes loading...');

// ✅ Auto-update rates every 5 minutes
let rateUpdateInterval;

async function updateRatesInDatabase() {
    try {
        console.log('💱 Fetching live exchange rates from Flutterwave...');
        
        const exchangeRatesService = require('../services/exchangerates.service');
        const ratesResult = await exchangeRatesService.getLiveRates();
        
        if (ratesResult.success && ratesResult.data) {
            const { ngnToKsh, kshToNgn } = ratesResult.data;
            
            // ✅ DELETE only NON-MANUAL rates, then INSERT new API rates
            await db.query(`
                DELETE FROM exchange_rates 
                WHERE from_currency = 'NGN' 
                AND to_currency = 'KSH' 
                AND (manual_override = false OR manual_override IS NULL)
            `);
            
            await db.query(`
                DELETE FROM exchange_rates 
                WHERE from_currency = 'KSH' 
                AND to_currency = 'NGN' 
                AND (manual_override = false OR manual_override IS NULL)
            `);
            
            // Insert fresh API rates
            await db.query(`
                INSERT INTO exchange_rates (from_currency, to_currency, rate, source, manual_override, created_at)
                VALUES ('NGN', 'KSH', $1, 'Flutterwave', false, NOW())
            `, [ngnToKsh]);
            
            await db.query(`
                INSERT INTO exchange_rates (from_currency, to_currency, rate, source, manual_override, created_at)
                VALUES ('KSH', 'NGN', $1, 'Flutterwave', false, NOW())
            `, [kshToNgn]);
            
            console.log('✅ Live rates fetched and saved to DB:', { ngnToKsh, kshToNgn });
            
            return { ngnToKsh, kshToNgn };
        } else {
            console.log('⚠️ Failed to fetch rates, using fallback');
            return null;
        }
    } catch (error) {
        console.error('❌ Rate update error:', error.message);
        return null;
    }
}

// ✅ Start auto-update when server starts
(async function initializeRates() {
    console.log('🚀 Initializing rate auto-update service...');
    
    // Wait 10 seconds before first update (let server fully start)
    console.log('⏳ Waiting 10 seconds before first rate update...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Update after delay
    await updateRatesInDatabase();
    
    // Then update every 5 minutes
    rateUpdateInterval = setInterval(updateRatesInDatabase, 5 * 60 * 1000);
    
    console.log('✅ Rate auto-update service started (every 5 minutes)');
})();

// GET /api/v1/rates - Get latest exchange rates (prioritize manual rates)
router.get('/', async (req, res) => {
    try {
        // ✅ STEP 1: Check for manual override rates FIRST
        const manualRates = await db.query(`
            SELECT from_currency, to_currency, rate, created_at as updated_at
            FROM exchange_rates 
            WHERE manual_override = true 
            ORDER BY created_at DESC 
            LIMIT 2
        `);
        
        if (manualRates.rows.length === 2) {
            // Manual rates exist - use them
            console.log('📌 Using MANUAL exchange rates (admin override)');
            
            const rates = {};
            manualRates.rows.forEach(row => {
                if (row.from_currency === 'NGN' && row.to_currency === 'KSH') {
                    rates.ngnToKsh = parseFloat(row.rate);
                } else if (row.from_currency === 'KSH' && row.to_currency === 'NGN') {
                    rates.kshToNgn = parseFloat(row.rate);
                }
            });
            
            return res.json({
                status: 'success',
                data: {
                    ngnToKsh: rates.ngnToKsh || 0.0906,
                    kshToNgn: rates.kshToNgn || 11.0275,
                    updated_at: manualRates.rows[0].updated_at,
                    manual_override: true,
                    source: 'manual'
                }
            });
        }
        
        // ✅ STEP 2: No manual rates - use API rates from database
        const apiRates = await db.query(`
            SELECT from_currency, to_currency, rate, created_at as updated_at
            FROM exchange_rates 
            WHERE (manual_override = false OR manual_override IS NULL)
            ORDER BY created_at DESC 
            LIMIT 2
        `);
        
        if (apiRates.rows.length >= 2) {
            console.log('📊 Using API exchange rates from database');
            
            const rates = {};
            apiRates.rows.forEach(row => {
                if (row.from_currency === 'NGN' && row.to_currency === 'KSH') {
                    rates.ngnToKsh = parseFloat(row.rate);
                } else if (row.from_currency === 'KSH' && row.to_currency === 'NGN') {
                    rates.kshToNgn = parseFloat(row.rate);
                }
            });
            
            return res.json({
                status: 'success',
                data: {
                    ngnToKsh: rates.ngnToKsh || 0.0906,
                    kshToNgn: rates.kshToNgn || 11.0275,
                    updated_at: apiRates.rows[0].updated_at,
                    manual_override: false,
                    source: 'api_database'
                }
            });
        }
        
        // ✅ STEP 3: Fallback - fetch fresh rates from API
        console.log('⚠️ No rates in database, fetching fresh rates...');
        const ratesResult = await flutterwaveService.getExchangeRates();
        
        if (ratesResult.success) {
            return res.json({
                status: 'success',
                data: {
                    ...ratesResult.data,
                    manual_override: false,
                    source: 'live_api'
                }
            });
        }
        
        // ✅ STEP 4: Ultimate fallback
        console.log('⚠️ Using hardcoded fallback rates');
        res.json({
            status: 'success',
            data: {
                ngnToKsh: 0.0906,
                kshToNgn: 11.0275,
                updated_at: new Date().toISOString(),
                manual_override: false,
                source: 'fallback'
            }
        });
    } catch (error) {
        console.error('Get rates error:', error);
        res.json({
            status: 'success',
            data: {
                ngnToKsh: 0.0906,
                kshToNgn: 11.0275,
                updated_at: new Date().toISOString(),
                manual_override: false,
                source: 'error_fallback'
            }
        });
    }
});

// POST /api/v1/rates/account/generate - Generate REAL virtual account
router.post('/account/generate', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
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
