const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

// Get all wallets
router.get('/', async (req, res) => {
  res.json({ status: 'success', message: 'Get all wallets endpoint' });
});

// Get specific wallet
router.get('/:currency', async (req, res) => {
  res.json({ status: 'success', message: 'Get wallet endpoint' });
});

// Get wallet transactions
router.get('/:currency/transactions', async (req, res) => {
  res.json({ status: 'success', message: 'Get wallet transactions endpoint' });
});

module.exports = router;
