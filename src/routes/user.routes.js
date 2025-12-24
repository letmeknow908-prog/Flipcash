const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kyc.controller');

router.post('/kyc', authenticateToken, kycController.submitKYC);
router.get('/kyc', authenticateToken, kycController.getKYCStatus);
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
