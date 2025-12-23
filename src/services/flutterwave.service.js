const Flutterwave = require('flutterwave-node-v3');

const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);

class FlutterwaveService {
  // Generate virtual account for user
  async generateVirtualAccount(user) {
    try {
      console.log('🏦 Generating virtual account for:', user.email);

      const payload = {
        email: user.email,
        is_permanent: true,
        tx_ref: `VA-${user.id}-${Date.now()}`,
        firstname: user.firstName || user.first_name,
        lastname: user.lastName || user.last_name,
        narration: `FlipCash ${user.firstName || user.first_name}`,
      };

      const response = await flw.VirtualAcct.create(payload);
      
      console.log('✅ Flutterwave response:', response);

      if (response.status === 'success') {
        return {
          accountNumber: response.data.account_number,
          accountBank: response.data.bank_name,
          accountName: response.data.account_name,
          provider: 'flutterwave',
          reference: response.data.flw_ref
        };
      }
      
      throw new Error(response.message || 'Failed to create virtual account');
    } catch (error) {
      console.error('❌ Flutterwave error:', error);
      throw error;
    }
  }

  // Verify payment
  async verifyPayment(transactionId) {
    try {
      const response = await flw.Transaction.verify({ id: transactionId });
      
      if (response.status === 'success' && response.data.status === 'successful') {
        return {
          success: true,
          amount: response.data.amount,
          currency: response.data.currency,
          reference: response.data.tx_ref,
          customerEmail: response.data.customer.email
        };
      }
      
      return { success: false };
    } catch (error) {
      console.error('❌ Verify payment error:', error);
      throw error;
    }
  }

  // Get exchange rates
  async getExchangeRates() {
    try {
      // Flutterwave doesn't have a direct rate API, so we'll use fallback
      // You can integrate with exchangerate-api.com (free) or similar
      const rates = {
        NGN_KSH: 0.285,  // 1 NGN = 0.285 KSH
        KSH_NGN: 3.508,  // 1 KSH = 3.508 NGN
        NGN_USD: 0.0012,
        KSH_USD: 0.0077,
        USD_NGN: 833.33,
        USD_KSH: 129.87,
        updated_at: new Date()
      };
      
      return rates;
    } catch (error) {
      console.error('❌ Get rates error:', error);
      // Return fallback rates
      return {
        NGN_KSH: 0.285,
        KSH_NGN: 3.508,
        NGN_USD: 0.0012,
        KSH_USD: 0.0077,
        USD_NGN: 833.33,
        USD_KSH: 129.87,
        updated_at: new Date()
      };
    }
  }
}

module.exports = new FlutterwaveService();
