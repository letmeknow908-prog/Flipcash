const axios = require('axios');
const logger = require('../utils/logger');

class VirtualAccountService {
  // Generate virtual Naira account using Paystack
  static async generateVirtualAccount(user) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        // Development mode - generate fake account
        const fakeAccountNumber = `990${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
        return {
          accountNumber: fakeAccountNumber,
          bankName: 'Wema Bank',
          accountName: `${user.first_name} ${user.last_name}`,
        };
      }

      // Production - use Paystack API
      const response = await axios.post(
        'https://api.paystack.co/dedicated_account',
        {
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          preferred_bank: 'wema-bank',
          country: 'NG',
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status) {
        return {
          accountNumber: response.data.data.account_number,
          bankName: response.data.data.bank.name,
          accountName: response.data.data.account_name,
        };
      } else {
        throw new Error('Failed to create virtual account');
      }
    } catch (error) {
      logger.error('Virtual account generation failed:', error.response?.data || error.message);
      throw new Error('Failed to generate virtual account. Please try again.');
    }
  }

  // Verify virtual account transaction
  static async verifyTransaction(reference) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        // Mock verification in dev mode
        return {
          verified: true,
          amount: 10000,
          currency: 'NGN',
          status: 'success',
        };
      }

      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      return {
        verified: response.data.data.status === 'success',
        amount: response.data.data.amount / 100, // Paystack amounts are in kobo
        currency: response.data.data.currency,
        status: response.data.data.status,
      };
    } catch (error) {
      logger.error('Transaction verification failed:', error);
      throw error;
    }
  }
}

module.exports = VirtualAccountService;
