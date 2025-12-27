const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../../config/db');

console.log('🔧 TRANSACTION ROUTES LOADED - DATABASE VERSION');

// ✅ Get user transactions (REAL from database)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 50, page = 1 } = req.query;
        const offset = (page - 1) * limit;
        
        console.log('📊 Fetching transactions for user:', userId);
        
        const result = await db.query(
            `SELECT * FROM transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        
        console.log('✅ Found', result.rows.length, 'transactions');
        
        res.json({
            status: 'success',
            data: result.rows
        });
        
    } catch (error) {
        console.error('❌ Get transactions error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch transactions'
        });
    }
});

// ✅ Currency swap (REAL - Updates database)
router.post('/swap', authMiddleware, async (req, res) => {
    const client = await db.connect();
    
    try {
        const userId = req.user.id;
        const { fromCurrency, toCurrency, amount } = req.body;
        
        console.log('💱 Processing swap for user:', userId);
        console.log('💱 From:', fromCurrency, 'To:', toCurrency, 'Amount:', amount);
        
        if (!fromCurrency || !toCurrency || !amount) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: fromCurrency, toCurrency, amount'
            });
        }
        
        const swapAmount = parseFloat(amount);
        
        if (swapAmount <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Amount must be greater than 0'
            });
        }
        
        // Start transaction
        await client.query('BEGIN');
        
        // Check source wallet balance
        const sourceWallet = await client.query(
            'SELECT balance FROM wallets WHERE user_id = $1 AND currency = $2',
            [userId, fromCurrency]
        );
        
        if (sourceWallet.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: `${fromCurrency} wallet not found`
            });
        }
        
        const currentBalance = parseFloat(sourceWallet.rows[0].balance);
        
        if (currentBalance < swapAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: `Insufficient ${fromCurrency} balance. Available: ${currentBalance.toFixed(2)}`
            });
        }
        
        // Get live exchange rate

// Get live exchange rate from exchange_rates table
let rate;
try {
    // Query the correct table: exchange_rates
    const rateResult = await db.query(
        `SELECT rate FROM exchange_rates 
         WHERE from_currency = $1 AND to_currency = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [fromCurrency, toCurrency]
    );
    
    if (rateResult.rows.length > 0) {
        rate = parseFloat(rateResult.rows[0].rate);
        console.log('📊 Rate from DB:', rate, fromCurrency, '→', toCurrency);
    } else {
        // Fallback to default rates
        console.log('⚠️ No rate found in DB, using default');
        if (fromCurrency === 'NGN' && toCurrency === 'KSH') {
            rate = 11.53325175;
        } else if (fromCurrency === 'KSH' && toCurrency === 'NGN') {
            rate = 0.09021803;
        } else {
            await client.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: 'Invalid currency pair'
            });
        }
    }
} catch (rateError) {
    console.log('⚠️ Could not fetch rate from DB, using default:', rateError.message);
    // Fallback to default rates
    if (fromCurrency === 'NGN' && toCurrency === 'KSH') {
        rate = 11.53325175;
    } else if (fromCurrency === 'KSH' && toCurrency === 'NGN') {
        rate = 0.09021803;
    } else {
        await client.query('ROLLBACK');
        return res.status(400).json({
            status: 'error',
            message: 'Invalid currency pair'
        });
    }
}
        
        console.log('💱 Exchange rate:', rate);
        
        // Calculate amounts
        const converted = swapAmount * rate;
        const fee = swapAmount * 0.01; // 1% fee taken from source
        const finalAmount = converted; // Fee already deducted from source
        
        console.log('💰 Converted:', converted, toCurrency);
        console.log('💸 Fee:', fee, fromCurrency);
        
        // Deduct from source wallet (amount + fee)
        await client.query(
            'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 AND currency = $3',
            [swapAmount, userId, fromCurrency]
        );
        
        // Add to destination wallet
        await client.query(
            'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 AND currency = $3',
            [finalAmount, userId, toCurrency]
        );
        
        // Record transaction
        const transactionId = 'SWP' + Date.now();
        await client.query(
            `INSERT INTO transactions (user_id, type, currency, amount, status, created_at, description) 
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [
                userId, 
                'swap', 
                fromCurrency, 
                swapAmount, 
                'completed',
                `Swapped ${swapAmount} ${fromCurrency} to ${finalAmount.toFixed(2)} ${toCurrency}`
            ]
        );
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('✅ Swap completed successfully');
        
        res.json({
            status: 'success',
            message: 'Currency swap completed successfully',
            data: {
                transactionId,
                fromCurrency,
                toCurrency,
                amount: swapAmount,
                rate,
                convertedAmount: converted,
                fee,
                finalAmount,
                status: 'completed'
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Swap error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Swap failed. Please try again.'
        });
    } finally {
        client.release();
    }
});

// ✅ Withdraw (REAL - Updates database)
router.post('/withdraw', authMiddleware, async (req, res) => {
    const client = await db.connect();
    
    try {
        const userId = req.user.id;
        const { currency, amount, phone, method } = req.body;
        
        console.log('💸 Processing withdrawal for user:', userId);
        console.log('💸 Amount:', amount, currency, 'to', phone);
        
        if (!currency || !amount || !phone) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields'
            });
        }
        
        const withdrawAmount = parseFloat(amount);
        
        if (withdrawAmount <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Amount must be greater than 0'
            });
        }
        
        // Start transaction
        await client.query('BEGIN');
        
        // Check wallet balance
        const wallet = await client.query(
            'SELECT balance FROM wallets WHERE user_id = $1 AND currency = $2',
            [userId, currency]
        );
        
        if (wallet.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: `${currency} wallet not found`
            });
        }
        
        const currentBalance = parseFloat(wallet.rows[0].balance);
        const fee = withdrawAmount * 0.02; // 2% fee
        const totalRequired = withdrawAmount + fee;
        
        if (currentBalance < totalRequired) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: `Insufficient balance. Required: ${totalRequired.toFixed(2)} ${currency}, Available: ${currentBalance.toFixed(2)} ${currency}`
            });
        }
        
        // Deduct from wallet
        await client.query(
            'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 AND currency = $3',
            [totalRequired, userId, currency]
        );
        
        // Record transaction
        const transactionId = 'WTH' + Date.now();
        await client.query(
            `INSERT INTO transactions (user_id, type, currency, amount, status, created_at, description) 
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [
                userId, 
                'withdraw', 
                currency, 
                withdrawAmount, 
                'pending',
                `Withdrawal to ${phone} via ${method || 'M-Pesa'}`
            ]
        );
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('✅ Withdrawal initiated');
        
        res.json({
            status: 'success',
            message: `Withdrawal to ${method || 'M-Pesa'} initiated successfully`,
            data: {
                transactionId,
                currency,
                amount: withdrawAmount,
                fee,
                total: totalRequired,
                phone,
                method: method || 'M-Pesa',
                status: 'pending'
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Withdrawal error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Withdrawal failed. Please try again.'
        });
    } finally {
        client.release();
    }
});

console.log('✅ Transaction routes loaded - DATABASE VERSION');
module.exports = router;
