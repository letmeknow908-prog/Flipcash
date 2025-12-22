const express = require('express');
const router = express.Router();

// M-Pesa webhook (no authentication - validated via callback validation)
router.post('/mpesa', async (req, res) => {
  // TODO: Implement M-Pesa callback handling
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// Paystack webhook
router.post('/paystack', async (req, res) => {
  // TODO: Implement Paystack webhook handling
  res.json({ status: 'success' });
});

// Airtel Money webhook
router.post('/airtel', async (req, res) => {
  // TODO: Implement Airtel webhook handling
  res.json({ status: 'success' });
});

module.exports = router;
