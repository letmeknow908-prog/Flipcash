const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kyc.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// KYC Routes
router.post('/kyc', authenticateToken, kycController.submitKYC);
router.get('/kyc', authenticateToken, kycController.getKYCStatus);
router.put('/kyc/:userId/approve', authenticateToken, kycController.approveKYC);
router.put('/kyc/:userId/reject', authenticateToken, kycController.rejectKYC);

// Export the router - THIS IS CRITICAL!
module.exports = router;
