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
        // ✅ DYNAMIC FEE CALCULATION
const feeCalculator = require('../utils/feeCalculator');

let fees, finalAmount, totalDeducted;

if (fromCurrency === 'NGN') {
    // NGN → KSH: Use dynamic fees
    fees = feeCalculator.calculateFees(swapAmount);
    
    console.log('💰 Fee breakdown:', {
        tier: fees.tier,
        serviceFee: fees.serviceFee,
        swapFee: fees.swapFee,
        withdrawalFeeKSH: fees.withdrawalFeeKSH,
        totalRevenue: fees.totalRevenue,
        profit: fees.profit
    });
    
    // For NGN → KSH
    finalAmount = fees.finalAmountKSH;
    totalDeducted = swapAmount + fees.serviceFee; // Original amount + service fee
    
} else {
    // KSH → NGN: Simple flat 2% for now (can be enhanced later)
    const swapFee = swapAmount * 0.02;
    fees = {
        swapFee: swapFee,
        finalAmount: (swapAmount - swapFee) * rate,
        tier: 'Standard',
        serviceFee: 0,
        withdrawalFeeKSH: 0,
        swapFeePercent: 2,
        withdrawalFeePercent: 0
    };
    
    finalAmount = fees.finalAmount;
    totalDeducted = swapAmount; // Just the amount, no additional fees for KSH → NGN
}

console.log('💰 Final amount:', finalAmount, toCurrency);
console.log('💸 Total deducted:', totalDeducted, fromCurrency);
        
        // Deduct from source wallet (amount + fee)
        // ✅ Deduct from source wallet
console.log('💳 Deducting from wallet:', totalDeducted, fromCurrency);

// Check if user has enough balance (including fees)
if (currentBalance < totalDeducted) {
    await client.query('ROLLBACK');
    return res.status(400).json({
        status: 'error',
        message: `Insufficient ${fromCurrency} balance. Required: ${totalDeducted.toFixed(2)} (including fees). Available: ${currentBalance.toFixed(2)}`
    });
}

await client.query(
    'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 AND currency = $3',
    [totalDeducted, userId, fromCurrency]
);
        
        // Add to destination wallet
        await client.query(
            'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 AND currency = $3',
            [finalAmount, userId, toCurrency]
        );
        
        // Record transaction
        const transactionId = 'SWP' + Date.now();
await client.query(
    `INSERT INTO transactions (user_id, type, currency, amount, status, created_at) 
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
        userId, 
        'swap', 
        fromCurrency, 
        swapAmount, 
        'completed'
    ]
);
        
        // Commit transaction
        // After "await client.query('COMMIT');" line ~245
await client.query('COMMIT');
console.log('✅ Swap completed successfully');

// ✅ NOW store tier info (after successful commit)
if (fromCurrency === 'NGN') {
    try {
        await db.query(
            `UPDATE wallets 
             SET current_tier = $1, 
                 last_swap_amount = $2, 
                 last_swap_date = NOW() 
             WHERE user_id = $3 AND currency = 'KSH'`,
            [fees.tier, swapAmount, userId]
        );
        console.log(`✅ Stored tier '${fees.tier}' for user ${userId}`);
    } catch (tierError) {
        console.error('⚠️ Failed to store tier:', tierError);
        // Non-critical error - swap already completed
    }
}
        
        // ✅ ADD: Notify user
        const notificationService = require('../services/notification.service');
        await notificationService.notifySwap(userId, fromCurrency, toCurrency, swapAmount, finalAmount);
        
res.json({
    status: 'success',
    message: 'Currency swap completed successfully',
    data: {
        transactionId,
        fromCurrency,
        toCurrency,
        amount: swapAmount,
        rate,
        fees: {
            tier: fees.tier,
            serviceFee: fees.serviceFee || 0,
            swapFee: fees.swapFee,
            swapFeePercent: fees.swapFeePercent || 0,
            withdrawalFeeKSH: fees.withdrawalFeeKSH || 0,
            withdrawalFeePercent: fees.withdrawalFeePercent || 0,
            totalFeeNGN: totalDeducted
        },
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

router.post('/withdraw', authMiddleware, async (req, res) => {
    const client = await db.connect();
    
    try {
        const userId = req.user.id;
        const { currency, amount, phone, beneficiaryName, method } = req.body;
        
        console.log('🔍 [WITHDRAW DEBUG] Step 1: Request received');
        console.log('📋 User ID:', userId);
        console.log('📋 Request body:', JSON.stringify({ currency, amount, phone, beneficiaryName, method }, null, 2));
        
        // Validate inputs
        if (!currency || !amount || !phone || !beneficiaryName) {
            console.log('❌ [WITHDRAW DEBUG] Step 2: Validation FAILED - Missing fields');
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: currency, amount, phone, beneficiaryName',
                debug: { currency, amount, phone, beneficiaryName }
            });
        }
        console.log('✅ [WITHDRAW DEBUG] Step 2: Validation PASSED');

        const withdrawAmount = parseFloat(amount);
        console.log('💰 [WITHDRAW DEBUG] Step 3: Parsed amount:', withdrawAmount);
        
        // ✅ ADD: 30 KSH minimum validation
        if (currency === 'KSH' && withdrawAmount < 30) {
            console.log('❌ [WITHDRAW DEBUG] Step 3: Amount below 30 KSH minimum');
            return res.status(400).json({
                status: 'error',
                message: 'Minimum withdrawal amount is 30 KSH (Flutterwave requirement)'
            });
        }
        
        await client.query('BEGIN');
        console.log('✅ [WITHDRAW DEBUG] Step 4: Transaction BEGIN');
        
        // Check balance
        console.log('🔍 [WITHDRAW DEBUG] Step 5: Checking wallet balance...');
        const wallet = await client.query(
            'SELECT balance FROM wallets WHERE user_id = $1 AND currency = $2',
            [userId, currency]
        );
        
        if (wallet.rows.length === 0) {
            console.log('❌ [WITHDRAW DEBUG] Step 5: Wallet NOT FOUND');
            await client.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: `${currency} wallet not found`
            });
        }
        
        const currentBalance = parseFloat(wallet.rows[0].balance);
        const fee = withdrawAmount * 0.02;
        const totalRequired = withdrawAmount + fee;
        
        console.log('✅ [WITHDRAW DEBUG] Step 5: Wallet found');
        console.log('💵 Current balance:', currentBalance);
        console.log('💸 Fee (2%):', fee);
        console.log('💰 Total required:', totalRequired);
        
        if (currentBalance < totalRequired) {
            console.log('❌ [WITHDRAW DEBUG] Step 6: INSUFFICIENT BALANCE');
            await client.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: `Insufficient balance. Required: ${totalRequired.toFixed(2)} ${currency}, Available: ${currentBalance.toFixed(2)} ${currency}`
            });
        }
        console.log('✅ [WITHDRAW DEBUG] Step 6: Balance check PASSED');
        
        // Deduct from wallet
        console.log('🔍 [WITHDRAW DEBUG] Step 7: Deducting from wallet...');
        await client.query(
            'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 AND currency = $3',
            [totalRequired, userId, currency]
        );
        console.log('✅ [WITHDRAW DEBUG] Step 7: Wallet deducted successfully');
        
        // Process payout via Flutterwave
        console.log('🔍 [WITHDRAW DEBUG] Step 8: Calling Flutterwave API...');
        console.log('📤 Flutterwave payload:', JSON.stringify({
            amount: withdrawAmount,
            phone,
            beneficiaryName,
            method: method || 'MPESA',
            userId,
            currency
        }, null, 2));
        
        const flutterwaveService = require('../services/flutterwave.service');
        const payoutResult = await flutterwaveService.processKenyaPayout({
            amount: withdrawAmount,
            phone,
            beneficiaryName,
            method: method || 'MPESA',
            userId,
            currency
        });

        console.log('📥 [WITHDRAW DEBUG] Step 8: Flutterwave response received');
        console.log('📦 Response:', JSON.stringify(payoutResult, null, 2));

        if (payoutResult.success) {
            console.log('✅ [WITHDRAW DEBUG] Step 9: Payout SUCCESS');
            
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
                    'processing',
                    `Withdrawal to ${beneficiaryName} (${phone}) - ${payoutResult.reference}`
                ]
            );
            
            await client.query('COMMIT');
            console.log('✅ [WITHDRAW DEBUG] Step 10: Transaction COMMITTED');
            
            // ✅ ADD: Notify user
            const notificationService = require('../services/notification.service');
            await notificationService.notifyWithdrawal(userId, withdrawAmount, currency, beneficiaryName);
            
            return res.json({
                status: 'success',
                message: `Withdrawal sent to ${beneficiaryName}`,
                data: {
                    transactionId,
                    reference: payoutResult.reference,
                    recipient: beneficiaryName,
                    phone,
                    amount: withdrawAmount,
                    fee,
                    total: totalRequired
                }
            });
        } else {
            console.log('❌ [WITHDRAW DEBUG] Step 9: Payout FAILED');
            console.log('❌ Error from Flutterwave:', payoutResult.error);
            
            // Refund if payout failed
            await client.query('ROLLBACK');
            console.log('✅ [WITHDRAW DEBUG] Step 10: Transaction ROLLED BACK');
            
            return res.status(500).json({
                status: 'error',
                message: payoutResult.error || 'Withdrawal failed',
                debug: {
                    flutterwaveError: payoutResult.error,
                    shouldRefund: payoutResult.shouldRefund
                }
            });
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ [WITHDRAW DEBUG] EXCEPTION CAUGHT');
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        res.status(500).json({
            status: 'error',
            message: 'Withdrawal failed. Please try again.',
            debug: {
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack
            }
        });
    } finally {
        client.release();
        console.log('✅ [WITHDRAW DEBUG] Database client released');
    }
});

console.log('✅ Transaction routes loaded - DATABASE VERSION');
module.exports = router;
