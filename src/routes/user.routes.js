// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
// 1. Correctly import the KYC controller
const kycController = require('../controllers/kyc.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// 2. Define the route. This path is relative to '/api/v1/users'
router.post('/kyc', authenticateToken, kycController.submitKYC);
router.get('/kyc', authenticateToken, kycController.getKYCStatus);

// Admin routes (if applicable)
router.put('/kyc/:userId/approve', authenticateToken, kycController.approveKYC);
router.put('/kyc/:userId/reject', authenticateToken, kycController.rejectKYC);

// 3. Export the router
module.exports = router;
