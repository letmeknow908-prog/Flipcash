const express = require('express');
const router = express.Router();

// Get all transactions
router.get('/', (req, res) => {
  const { limit = 20, page = 1 } = req.query;
  
  res.json({
    status: 'success',
    data: {
      transactions: [
        {
          id: 'TXN001',
          type: 'swap',
          from: 'NGN',
          to: 'KSH',
          amount: 10000,
          convertedAmount: 2850,
          fee: 28.5,
          status: 'completed',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'TXN002',
          type: 'withdraw',
          currency: 'KSH',
          amount: 1000,
          phoneNumber: '0712345678',
          provider: 'mpesa',
          status: 'completed',
          createdAt: new Date(Date.now() - 172800000).toISOString()
        }
      ],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 2
      }
    }
  });
});

// Currency swap
router.post('/swap', (req, res) => {
  const { fromCurrency, toCurrency, amount } = req.body;
  
  if (!fromCurrency || !toCurrency || !amount) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: fromCurrency, toCurrency, amount'
    });
  }
  
  const rates = {
    NGN_KSH: 0.285,
    KSH_NGN: 3.508
  };
  
  const rate = rates[`${fromCurrency}_${toCurrency}`];
  const converted = parseFloat(amount) * rate;
  const fee = converted * 0.01; // 1% fee
  const finalAmount = converted - fee;
  
  res.json({
    status: 'success',
    message: 'Swap completed successfully',
    data: {
      transactionId: 'TXN' + Date.now(),
      fromCurrency,
      toCurrency,
      amount: parseFloat(amount),
      rate,
      convertedAmount: converted,
      fee,
      finalAmount,
      status: 'completed',
      createdAt: new Date().toISOString()
    }
  });
});

// Withdraw
router.post('/withdraw', (req, res) => {
  const { currency, amount, phoneNumber, provider } = req.body;
  
  if (!currency || !amount || !phoneNumber || !provider) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields'
    });
  }
  
  // Mock balance check
  const balance = 0;
  const withdrawAmount = parseFloat(amount);
  const fee = withdrawAmount * 0.015; // 1.5% withdrawal fee
  const total = withdrawAmount + fee;
  
  if (total > balance) {
    return res.status(400).json({
      status: 'error',
      message: 'Insufficient balance',
      data: {
        required: total,
        available: balance,
        shortfall: total - balance
      }
    });
  }
  
  res.json({
    status: 'success',
    message: `Withdrawal to ${provider} initiated`,
    data: {
      transactionId: 'WTH' + Date.now(),
      currency,
      amount: withdrawAmount,
      fee,
      total,
      phoneNumber,
      provider,
      status: 'processing',
      createdAt: new Date().toISOString()
    }
  });
});

module.exports = router;
