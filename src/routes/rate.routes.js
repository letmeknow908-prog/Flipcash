const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

// Get all exchange rates
router.get('/', async (req, res) => {
  res.json({ 
    status: 'success', 
    data: {
      rates: [
        { from: 'NGN', to: 'KSH', rate: 0.29, lastUpdated: new Date() },
        { from: 'BTC', to: 'KSH', rate: 13500000, lastUpdated: new Date() },
        { from: 'ETH', to: 'KSH', rate: 450000, lastUpdated: new Date() },
        { from: 'USDT', to: 'KSH', rate: 129, lastUpdated: new Date() },
      ]
    }
  });
});

// Get specific rate
router.get('/:from/:to', async (req, res) => {
  res.json({ status: 'success', message: 'Get specific rate endpoint' });
});

module.exports = router;
