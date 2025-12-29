const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// Flutterwave Webhook Handler
router.post('/flutterwave', async (req, res) => {
    try {
        // ✅ FIX: Check both FLW_WEBHOOK_SECRET and FLW_SECRET_HASH
        const secretHash = process.env.FLW_WEBHOOK_SECRET || process.env.FLW_SECRET_HASH;
        const signature = req.headers['verif-hash'];
        
        console.log('✅ Webhook received from Flutterwave');
        console.log('🔍 Event:', req.body.event);
        console.log('🔍 Data:', JSON.stringify(req.body.data, null, 2));
        
        // Verify webhook signature
        if (!signature || signature !== secretHash) {
            console.log('❌ Invalid webhook signature');
            console.log('Expected:', secretHash);
            console.log('Received:', signature);
            return res.status(401).json({ status: 'error', message: 'Invalid signature' });
        }
        
        console.log('✅ Webhook verified successfully');
        
        // Process charge.completed event
        if (req.body.event === 'charge.completed') {
            await handleChargeCompleted(req.body.data);
        }
        
        // Process transfer.completed event
        if (req.body.event === 'transfer.completed') {
            await handleTransferCompleted(req.body.data);
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
        console.log('💰 Processing deposit...');
        console.log('Status:', data.status);
        console.log('Amount:', data.amount, data.currency);
        console.log('TX Ref:', data.tx_ref);
        console.log('Customer:', data.customer?.email);

        // Only process successful NGN transactions
        if (data.status !== 'successful') {
            console.log('⚠️ Transaction not successful:', data.status);
            return;
        }

        if (data.currency !== 'NGN') {
            console.log('⚠️ Non-NGN currency:', data.currency);
            return;
        }

        // Extract user_id from tx_ref (format: FLIPCASH_USERID_TIMESTAMP or flipcash_USERID_TIMESTAMP)
        const parts = data.tx_ref.split('_');
        const userId = parseInt(parts[1]);

        console.log('👤 User ID from tx_ref:', userId);

        if (!userId || isNaN(userId)) {
            console.log('❌ Invalid user ID in tx_ref:', data.tx_ref);
            return;
        }

        // Check if transaction already processed
        const existingTx = await db.query(
            'SELECT id FROM transactions WHERE reference = $1',
            [data.flw_ref || data.tx_ref]
        );

        if (existingTx.rows.length > 0) {
            console.log('⚠️ Transaction already processed:', data.flw_ref);
            return;
        }

        // Credit user's NGN wallet
        console.log(`💵 Crediting ${data.amount} NGN to user ${userId}...`);
        
        await db.query(`
            UPDATE wallets 
            SET balance = balance + $1 
            WHERE user_id = $2 AND currency = 'NGN'
        `, [data.amount, userId]);

        // Record transaction
        await db.query(`
            INSERT INTO transactions 
            (user_id, type, amount, currency, status, reference, metadata, created_at)
            VALUES ($1, 'deposit', $2, 'NGN', 'completed', $3, $4, NOW())
        `, [
            userId,
            data.amount,
            data.flw_ref || data.tx_ref,
            JSON.stringify({
                tx_ref: data.tx_ref,
                flw_ref: data.flw_ref,
                customer: data.customer,
                payment_type: data.payment_type
            })
        ]);

        console.log(`✅ Deposit processed: ${data.amount} NGN credited to user ${userId}`);
        
        // ✅ ADD: Notify user
        const notificationService = require('../services/notification.service');
        await notificationService.notifyDeposit(userId, data.amount, 'NGN');

    } catch (error) {
        console.error('❌ Error processing deposit:', error);
        throw error;
    }
}

// Handle completed withdrawals
async function handleTransferCompleted(data) {
    try {
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
        
        // ✅ ADD: Notify user if completed
        if (data.status === 'SUCCESSFUL') {
            const txResult = await db.query('SELECT user_id, amount, currency FROM transactions WHERE reference = $1', [data.reference]);
            if (txResult.rows.length > 0) {
                const notificationService = require('../services/notification.service');
                await notificationService.notifyWithdrawalCompleted(txResult.rows[0].user_id, txResult.rows[0].amount, txResult.rows[0].currency);
            }
        }
    } catch (error) {
        console.error('❌ Error processing withdrawal:', error);
    }
}

console.log('✅ Webhook routes loaded');
module.exports = router;
