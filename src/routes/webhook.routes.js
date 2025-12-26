const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Flutterwave Webhook Handler
router.post('/flutterwave', async (req, res) => {
    try {
        const secretHash = process.env.FLW_WEBHOOK_SECRET;
        const signature = req.headers['verif-hash'];
        
        console.log('✅ Webhook received from Flutterwave');
        console.log('🔍 Event:', req.body.event);
        console.log('🔍 TX Ref:', req.body.data?.tx_ref);
        
        // Verify webhook signature
        if (!signature || signature !== secretHash) {
            console.log('❌ Invalid webhook signature');
            return res.status(401).json({ status: 'error', message: 'Invalid signature' });
        }
        
        console.log('✅ Webhook verified successfully');
        
        // Process different event types
        if (req.body.event === 'charge.completed') {
            const data = req.body.data;
            
            if (data.status === 'successful' && data.currency === 'NGN') {
                // Extract user_id from tx_ref (format: flipcash_USERID_TIMESTAMP)
                const parts = data.tx_ref.split('_');
                const userId = parseInt(parts[1]);
                
                console.log('💰 Processing deposit for user:', userId);
                
                // Credit user's NGN wallet
                await db.query(`
                    UPDATE wallets 
                    SET balance = balance + $1 
                    WHERE user_id = $2 AND currency = 'NGN'
                `, [data.amount, userId]);
                
                // Record transaction
                await db.query(`
                    INSERT INTO transactions 
                    (user_id, type, amount, currency, status, reference, metadata)
                    VALUES ($1, 'deposit', $2, 'NGN', 'completed', $3, $4)
                `, [
                    userId,
                    data.amount,
                    data.flw_ref,
                    JSON.stringify({
                        tx_ref: data.tx_ref,
                        customer: data.customer
                    })
                ]);
                
                console.log(`✅ Deposit processed: ${data.amount} NGN credited to user ${userId}`);
            }
        }
        
        res.json({ status: 'success' });
    } catch (error) {
        console.error('❌ Webhook processing error:', error);
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
