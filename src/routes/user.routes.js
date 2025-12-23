const express = require('express');
const router = express.Router();

router.get('/me', (req, res) => {
  res.json({
    status: 'success',
    data: {
      id: '123',
      email: 'user@flipcash.app',
      firstName: 'Steven',
      kycStatus: 'pending'
    }
  });
});

module.exports = router;
