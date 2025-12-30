const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const adminMiddleware = require('../middleware/admin.middleware');

// Manual refund endpoint
router.post('/manual', adminMiddleware, async (req, res) => {
    const client = await db.connect();
    
    try {
        const { userId, currency, amount, transactionId, reason } = req.body;
        const adminId = req.admin.id;
        
        if (!userId || !currency || !amount || !transactionId) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields'
            });
        }
        
        console.log('🔄 Admin manual refund:', { userId, currency, amount, transactionId, adminId });
        
        await client.query('BEGIN');
        
        // Refund to user's wallet
        await client.query(
            'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 AND currency = $3',
            [amount, userId, currency]
        );
        
        // Record refund transaction
        const refundTxId = 'RFD' + Date.now();
        await client.query(
            `INSERT INTO transactions (user_id, type, currency, amount, status, created_at, description) 
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [
                userId,
                'refund',
                currency,
                amount,
                'completed',
                `Admin manual refund for ${transactionId} - ${reason || 'No reason provided'}`
            ]
        );
        
        // Update original transaction status
        await client.query(
            'UPDATE transactions SET status = $1 WHERE id = $2',
            ['refunded', transactionId]
        );
        
        // Notify user
        const notificationService = require('../services/notification.service');
        await notificationService.create(userId, {
            title: 'Refund Issued',
            message: `You have received a refund of ${amount} ${currency} for transaction ${transactionId}.`,
            type: 'refund'
        });
        
        await client.query('COMMIT');
        
        console.log('✅ Admin manual refund completed:', refundTxId);
        
        res.json({
            status: 'success',
            message: 'Refund issued successfully',
            data: {
                refundId: refundTxId,
                amount,
                currency
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Admin manual refund error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to issue refund: ' + error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router;
