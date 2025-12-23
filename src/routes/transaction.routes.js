const express = require('express');
const router = express.Router();

router.post('/swap', (req, res) => {
  const { fromCurrency, toCurrency, amount } = req.body;
  const rate = fromCurrency === 'NGN' ? 0.285 : 3.508;
  const converted = parseFloat(amount) * rate;
  const fee = converted * 0.01;
  
  res.json({
    status: 'success',
    data: {
      rate,
      convertedAmount: converted,
      fee,
      finalAmount: converted - fee
    }
  });
});

router.post('/withdraw', (req, res) => {
  const { amount } = req.body;
  const balance = 0; // Mock
  
  if (parseFloat(amount) > balance) {
    return res.status(400).json({
      status: 'error',
      message: 'Insufficient balance'
    });
  }
  
  res.json({ status: 'success', message: 'Withdrawal initiated' });
});

module.exports = router;
