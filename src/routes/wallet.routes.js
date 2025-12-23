const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'success',
    data: {
      wallets: [
        { currency: 'NGN', balance: '0.00', symbol: '₦' },
        { currency: 'KSH', balance: '0.00', symbol: 'KSh' }
      ]
    }
  });
});

module.exports = router;
