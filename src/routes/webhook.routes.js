const express = require('express');
const router = express.Router();

router.post('/flutterwave', (req, res) => {
  console.log('Flutterwave webhook:', req.body);
  res.json({ status: 'success' });
});

router.post('/mpesa', (req, res) => {
  console.log('M-Pesa webhook:', req.body);
  res.json({ status: 'success' });
});

module.exports = router;
