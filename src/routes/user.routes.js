const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kyc.controller');

// Assuming you have authentication middleware
// If not, import it: const { authenticateToken } = require('../middleware/auth.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');

// KYC Routes
router.post('/kyc', authenticateToken, kycController.submitKYC);
router.get('/kyc', authenticateToken, kycController.getKYCStatus);

// Admin KYC routes (optional)
router.put('/kyc/:userId/approve', authenticateToken, kycController.approveKYC);
router.put('/kyc/:userId/reject', authenticateToken, kycController.rejectKYC);

// If you have other user routes, add them here
// Example:
// router.get('/me', authenticateToken, userController.getProfile);
// router.put('/me', authenticateToken, userController.updateProfile);

module.exports = router;
