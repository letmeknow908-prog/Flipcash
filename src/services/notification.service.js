const db = require('../../config/db');

class NotificationService {
    async createNotification(userId, type, title, message, metadata = {}) {
        try {
            await db.query(
                `INSERT INTO notifications (user_id, type, title, message, metadata) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [userId, type, title, message, JSON.stringify(metadata)]
            );
            console.log(`✅ Notification created for user ${userId}: ${title}`);
        } catch (error) {
            console.error('❌ Notification creation error:', error);
        }
    }

    async notifyDeposit(userId, amount, currency) {
        await this.createNotification(
            userId,
            'deposit',
            '💳 Deposit Received',
            `Your account has been credited with ${amount} ${currency}`,
            { amount, currency }
        );
    }

    async notifyWithdrawal(userId, amount, currency, recipient) {
        await this.createNotification(
            userId,
            'withdrawal',
            '💸 Withdrawal Initiated',
            `Withdrawal of ${amount} ${currency} to ${recipient} is being processed`,
            { amount, currency, recipient }
        );
    }

    async notifyWithdrawalCompleted(userId, amount, currency) {
        await this.createNotification(
            userId,
            'withdrawal',
            '✅ Withdrawal Completed',
            `Your withdrawal of ${amount} ${currency} has been completed successfully`,
            { amount, currency }
        );
    }

    async notifySwap(userId, fromCurrency, toCurrency, amount, received) {
        await this.createNotification(
            userId,
            'swap',
            '💱 Currency Swap Completed',
            `You swapped ${amount} ${fromCurrency} and received ${received} ${toCurrency}`,
            { fromCurrency, toCurrency, amount, received }
        );
    }

    async notifyKYCSubmitted(userId) {
        await this.createNotification(
            userId,
            'kyc',
            '📋 KYC Submitted',
            'Your KYC verification has been submitted and is under review. This usually takes 24-48 hours.',
            {}
        );
    }

    async notifyKYCApproved(userId) {
        await this.createNotification(
            userId,
            'kyc',
            '✅ KYC Approved',
            'Congratulations! Your KYC verification has been approved. You now have full access to all features.',
            {}
        );
    }

    async notifyKYCRejected(userId, reason) {
        await this.createNotification(
            userId,
            'kyc',
            '❌ KYC Rejected',
            `Your KYC verification was rejected. Reason: ${reason}. Please resubmit with correct information.`,
            { reason }
        );
    }
}

module.exports = new NotificationService();
