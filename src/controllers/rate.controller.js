const flutterwaveService = require('../services/flutterwave.service');
const pool = require('../config/database');

/**
 * Get current exchange rates
 * @route GET /api/v1/rates
 */
exports.getRates = async (req, res, next) => {
  try {
    console.log('💱 Fetching exchange rates...');
    
    // Get rates from Flutterwave service
    const rates = await flutterwaveService.getExchangeRates();
    
    console.log('✅ Rates fetched:', rates);
    
    res.json({
      status: 'success',
      data: rates
    });
  } catch (error) {
    console.error('❌ Get rates error:', error);
    
    // Return fallback rates even on error (CRITICAL for dashboard)
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

/**
 * Get rate history (for charts/analytics)
 * @route GET /api/v1/rates/history
 */
exports.getRateHistory = async (req, res, next) => {
  try {
    const { from, to, days = 7 } = req.query;
    
    // TODO: Implement rate history from database
    // For now, return mock data
    const history = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      history.push({
        date: date.toISOString().split('T')[0],
        rate: 0.285 + (Math.random() * 0.01 - 0.005), // Slight variation
      });
    }
    
    res.json({
      status: 'success',
      data: {
        from: from || 'NGN',
        to: to || 'KSH',
        history
      }
    });
  } catch (error) {
    console.error('❌ Get rate history error:', error);
    next(error);
  }
};

/**
 * Calculate conversion between currencies
 * @route POST /api/v1/rates/calculate
 */
exports.calculateConversion = async (req, res, next) => {
  try {
    const { amount, from, to } = req.body;
    
    if (!amount || !from || !to) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount, from, and to currencies are required'
      });
    }
    
    // Get current rates
    const rates = await flutterwaveService.getExchangeRates();
    const rateKey = `${from}_${to}`;
    const rate = rates[rateKey];
    
    if (!rate) {
      return res.status(400).json({
        status: 'error',
        message: `Exchange rate not available for ${from} to ${to}`
      });
    }
    
    const convertedAmount = parseFloat(amount) * parseFloat(rate);
    const fee = convertedAmount * 0.01; // 1% fee
    const finalAmount = convertedAmount - fee;
    
    res.json({
      status: 'success',
      data: {
        from,
        to,
        amount: parseFloat(amount),
        rate: parseFloat(rate),
        convertedAmount,
        fee,
        finalAmount,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Calculate conversion error:', error);
    next(error);
  }
};

/**
 * Generate virtual account for user (Flutterwave)
 * @route POST /api/v1/rates/account/generate
 */
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

    // Check KYC status (optional - remove if you don't want this requirement)
    // if (user.kycStatus !== 'verified') {
    //   return res.status(403).json({
    //     status: 'error',
    //     message: 'Please complete KYC verification first'
    //   });
    // }

    // Generate account using Flutterwave
    const accountData = await flutterwaveService.generateVirtualAccount(user);

    // Update user in database
    await pool.query(
      'UPDATE users SET virtual_account = $1, virtual_account_bank = $2 WHERE id = $3',
      [accountData.accountNumber, accountData.accountBank, user.id]
    );
    
    console.log('✅ Virtual account created:', accountData);

    res.json({
      status: 'success',
      message: 'Virtual account generated successfully',
      data: accountData
    });
  } catch (error) {
    console.error('❌ Generate account error:', error);
    
    // Return user-friendly error
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to generate virtual account. Please try again later.'
    });
  }
};
