const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const { validationRules, validate } = require('../middleware/validation');

router.use(authenticate);

// Swap currencies
router.post('/swap', validate(validationRules.swap), async (req, res) => {
  res.json({ status: 'success', message: 'Swap endpoint - Coming soon' });
});

// Withdraw to M-Pesa/Airtel
router.post('/withdraw', validate(validationRules.withdraw), async (req, res) => {
  res.json({ status: 'success', message: 'Withdrawal endpoint - Coming soon' });
});

// Get transaction history
router.get('/', async (req, res) => {
  res.json({ status: 'success', message: 'Transaction history endpoint' });
});

// Get transaction details
router.get('/:id', async (req, res) => {
  res.json({ status: 'success', message: 'Transaction details endpoint' });
});

module.exports = router;
