const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Flutterwave Webhook Handler
router.post('/flutterwave', async (req, res) => {
    try {
        const signature = req.headers['verif-hash'];
        const secretHash = process.env.FLW_SECRET_HASH;

        // Verify webhook signature
        if (!signature || signature !== secretHash) {
            console.log('❌ Invalid webhook signature');
            return res.status(401).json({ status: 'error', message: 'Invalid signature' });
        }

        const payload = req.body;
        console.log('📨 Flutterwave webhook received:', payload.event);

        // Handle different event types
        if (payload.event === 'charge.completed') {
            await handleChargeCompleted(payload.data);
        } else if (payload.event === 'transfer.completed') {
            await handleTransferCompleted(payload.data);
        }

        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Handle successful deposits
async function handleChargeCompleted(data) {
    try {
        const db = require('../../config/db');

        // Only process successful transactions
        if (data.status !== 'successful') {
            console.log('⚠️ Transaction not successful:', data.status);
            return;
        }

        console.log('💰 Processing deposit:', {
            amount: data.amount,
            currency: data.currency,
            customer: data.customer.email
        });

        // Find user by account number or email
        const userResult = await db.query(
            `SELECT u.id, u.email, va.account_number 
             FROM users u 
             JOIN virtual_accounts va ON u.id = va.user_id 
             WHERE va.account_number = $1 OR u.email = $2`,
            [data.account_number, data.customer.email]
        );

        if (userResult.rows.length === 0) {
            console.log('❌ User not found for account:', data.account_number);
            return;
        }

        const user = userResult.rows[0];

        // Check if transaction already processed
        const existingTx = await db.query(
            'SELECT id FROM transactions WHERE reference = $1',
            [data.flw_ref || data.tx_ref]
        );

        if (existingTx.rows.length > 0) {
            console.log('⚠️ Transaction already processed:', data.flw_ref);
            return;
        }

        // Convert currency to NGN if needed
        let amountNGN = data.amount;
        if (data.currency !== 'NGN') {
            console.log('⚠️ Non-NGN deposit detected:', data.currency);
            // You might want to convert here or reject
        }

        // Update user wallet
        await db.query(
            `INSERT INTO wallets (user_id, currency, balance) 
             VALUES ($1, 'NGN', $2) 
             ON CONFLICT (user_id, currency) 
             DO UPDATE SET balance = wallets.balance + $2`,
            [user.id, amountNGN]
        );

        // Record transaction
        await db.query(
            `INSERT INTO transactions 
             (user_id, type, currency, amount, status, reference, metadata, created_at) 
             VALUES ($1, 'deposit', 'NGN', $2, 'completed', $3, $4, NOW())`,
            [
                user.id,
                amountNGN,
                data.flw_ref || data.tx_ref,
                JSON.stringify({
                    payment_type: data.payment_type,
                    account_number: data.account_number,
                    bank: data.account_bank
                })
            ]
        );

        console.log('✅ Deposit processed successfully:', {
            userId: user.id,
            amount: amountNGN,
            reference: data.flw_ref
        });

    } catch (error) {
        console.error('❌ Error processing deposit:', error);
        throw error;
    }
}

// Handle completed withdrawals
async function handleTransferCompleted(data) {
    try {
        const db = require('../../config/db');

        console.log('💸 Processing withdrawal completion:', {
            status: data.status,
            reference: data.reference
        });

        // Update transaction status
        await db.query(
            `UPDATE transactions 
             SET status = $1, 
                 metadata = metadata || jsonb_build_object('flw_response', $2::jsonb),
                 updated_at = NOW()
             WHERE reference = $3`,
            [
                data.status === 'SUCCESSFUL' ? 'completed' : 'failed',
                JSON.stringify(data),
                data.reference
            ]
        );

        console.log('✅ Withdrawal status updated:', data.reference);
    } catch (error) {
        console.error('❌ Error processing withdrawal:', error);
    }
}

console.log('✅ Webhook routes loaded');
module.exports = router;
