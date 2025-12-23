const flutterwaveService = require('../services/flutterwave.service');

/**
 * Get current exchange rates
 */
exports.getRates = async (req, res, next) => {
  try {
    // Get rates from Flutterwave or use fallback
    let rates;
    try {
      rates = await flutterwaveService.getExchangeRates();
    } catch (error) {
      console.log('Flutterwave API error, using fallback rates');
      // Fallback rates - always return something
      rates = {
        NGN_KSH: 0.285,
        KSH_NGN: 3.508,
        NGN_USD: 0.0012,
        KSH_USD: 0.0077,
        USD_NGN: 833.33,
        USD_KSH: 129.87,
        updated_at: new Date()
      };
    }

    res.json({
      status: 'success',
      data: rates
    });
  } catch (error) {
    console.error('Get rates error:', error);
    // Even if everything fails, return fallback
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
 * Get rate history (placeholder)
 */
exports.getRateHistory = async (req, res, next) => {
  try {
    const { from, to, days = 30 } = req.query;

    // Return mock historical data
    const history = [];
    const baseRate = from === 'NGN' && to === 'KSH' ? 0.285 : 3.508;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      history.push({
        date: date.toISOString().split('T')[0],
        rate: baseRate + (Math.random() * 0.01 - 0.005),
        from,
        to
      });
    }

    res.json({
      status: 'success',
      data: { history }
    });
  } catch (error) {
    console.error('Get rate history error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Calculate conversion
 */
exports.calculateConversion = async (req, res, next) => {
  try {
    const { amount, from, to } = req.body;

    if (!amount || !from || !to) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: amount, from, to'
      });
    }

    // Get current rates
    let rates;
    try {
      rates = await flutterwaveService.getExchangeRates();
    } catch (error) {
      rates = {
        NGN_KSH: 0.285,
        KSH_NGN: 3.508,
        NGN_USD: 0.0012,
        KSH_USD: 0.0077,
        USD_NGN: 833.33,
        USD_KSH: 129.87
      };
    }

    const rateKey = `${from}_${to}`;
    const rate = rates[rateKey];

    if (!rate) {
      return res.status(400).json({
        status: 'error',
        message: `Exchange rate not available for ${from} to ${to}`
      });
    }

    const convertedAmount = parseFloat(amount) * rate;
    const fee = convertedAmount * 0.01; // 1% fee
    const finalAmount = convertedAmount - fee;

    res.json({
      status: 'success',
      data: {
        from,
        to,
        amount: parseFloat(amount),
        rate,
        convertedAmount,
        fee,
        finalAmount
      }
    });
  } catch (error) {
    console.error('Calculate conversion error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Generate virtual account
 */
exports.generateVirtualAccount = async (req, res, next) => {
  try {
    const { userId, email, firstName, lastName } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: email, firstName, lastName'
      });
    }

    // Try to generate account via Flutterwave
    let account;
    try {
      account = await flutterwaveService.generateVirtualAccount({
        id: userId || Date.now(),
        email,
        firstName,
        lastName
      });
    } catch (error) {
      console.error('Flutterwave error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to generate virtual account. Please try again later.'
      });
    }

    res.json({
      status: 'success',
      data: account
    });
  } catch (error) {
    console.error('Generate virtual account error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
