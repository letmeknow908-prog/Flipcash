const flutterwaveService = require('../services/flutterwave.service');

// Get exchange rates
exports.getRates = async (req, res, next) => {
  try {
    console.log('💱 Fetching exchange rates...');
    
    const rates = await flutterwaveService.getExchangeRates();
    
    res.json({
      status: 'success',
      data: rates
    });
  } catch (error) {
    console.error('❌ Get rates error:', error);
    
    // Return fallback rates even on error
    res.json({
      status: 'success',
      data: {
        NGN_KSH: 0.285,
        KSH_NGN: 3.508,
        NGN_USD: 0.0012,
        KSH_USD: 0.0077,
        USD_NGN: 833.33,
        USD_KSH: 129.87,
        updated_at: new Date()
      }
    });
  }
};

// Generate virtual account
exports.generateVirtualAccount = async (req, res, next) => {
  try {
    const user = req.user;
    
    console.log('🏦 Generating virtual account for user:', user.id);

    // Check if user already has virtual account
    if (user.virtualAccount || user.virtual_account) {
      return res.status(400).json({
        status: 'error',
        message: 'You already have a virtual account'
      });
    }

    // Generate account using Flutterwave
    const accountData = await flutterwaveService.generateVirtualAccount(user);

    // Update user in database
    const pool = require('../config/database');
    await pool.query(
      'UPDATE users SET virtual_account = $1, virtual_account_bank = $2 WHERE id = $3',
      [accountData.accountNumber, accountData.accountBank, user.id]
    );

    res.json({
      status: 'success',
      message: 'Virtual account generated successfully',
      data: accountData
    });
  } catch (error) {
    console.error('❌ Generate account error:', error);
    next(error);
  }
};
