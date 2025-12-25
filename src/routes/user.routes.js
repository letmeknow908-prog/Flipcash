// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kyc.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validateKYC } = require('../middleware/kycValidation'); // 🔴 ADD THIS LINE

// KYC Routes - Add validateKYC as middleware
router.post('/kyc', authenticateToken, validateKYC, kycController.submitKYC);
router.get('/kyc', authenticateToken, kycController.getKYCStatus);

router.put('/kyc/:userId/approve', authenticateToken, kycController.approveKYC);
router.put('/kyc/:userId/reject', authenticateToken, kycController.rejectKYC);

module.exports = router;
