const axios = require('axios');

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const FLUTTERWAVE_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.flutterwave.com/v3'
    : 'https://api.flutterwave.com/v3';

/**
 * Issue refund for failed transaction
 * @param {string} chargeId - Flutterwave transaction ID (e.g., chg_xxx)
 * @param {number} amount - Amount to refund
 * @param {string} reason - Reason for refund
 */
async function issueRefund(chargeId, amount, reason = 'Transaction failed') {
    try {
        console.log('🔄 Initiating refund:', { chargeId, amount, reason });
        
        const response = await axios.post(
            `${FLUTTERWAVE_BASE_URL}/refunds`,
            {
                amount: amount,
                reason: reason,
                charge_id: chargeId
            },
            {
                headers: {
                    'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Refund response:', response.data);
        
        if (response.data.status === 'success') {
            return {
                success: true,
                refundId: response.data.data.id,
                status: response.data.data.status,
                amountRefunded: response.data.data.amount_refunded,
                message: 'Refund initiated successfully'
            };
        } else {
            return {
                success: false,
                error: response.data.message || 'Refund failed'
            };
        }
    } catch (error) {
        console.error('❌ Refund error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
}

/**
 * Check refund status
 * @param {string} refundId - Refund ID to check
 */
async function checkRefundStatus(refundId) {
    try {
        const response = await axios.get(
            `${FLUTTERWAVE_BASE_URL}/refunds/${refundId}`,
            {
                headers: {
                    'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.data.status === 'success') {
            return {
                success: true,
                status: response.data.data.status,
                amountRefunded: response.data.data.amount_refunded
            };
        } else {
            return {
                success: false,
                error: 'Failed to check refund status'
            };
        }
    } catch (error) {
        console.error('❌ Check refund status error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Manual balance refund (when Flutterwave refund not possible)
 * @param {number} userId - User ID
 * @param {string} currency - Currency (KSH/NGN)
 * @param {number} amount - Amount to refund
 * @param {string} transactionId - Original transaction ID
 * @param {object} db - Database connection
 */
async function manualBalanceRefund(userId, currency, amount, transactionId, db) {
    const client = await db.connect();
    
    try {
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
                `Refund for failed transaction ${transactionId}`
            ]
        );
        
        await client.query('COMMIT');
        
        console.log('✅ Manual refund completed:', { userId, currency, amount, refundTxId });
        
        return {
            success: true,
            refundId: refundTxId,
            message: 'Balance refunded successfully'
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Manual refund error:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        client.release();
    }
}

module.exports = {
    issueRefund,
    checkRefundStatus,
    manualBalanceRefund
};
