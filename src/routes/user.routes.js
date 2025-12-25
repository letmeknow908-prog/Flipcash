const express = require('express');
const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'User routes working!' });
});

// KYC placeholder
router.post('/kyc', (req, res) => {
  res.json({ 
    message: 'KYC endpoint ready', 
    status: 'will be implemented' 
  });
});

router.get('/kyc', (req, res) => {
  res.json({ 
    message: 'Get KYC status endpoint', 
    status: 'working' 
  });
});

module.exports = router;
