const express = require('express');
const router = express.Router();

let kycController;
let authenticateToken;

try {
    kycController = require('../controllers/kyc.controller');
} catch (error) {
    console.error('⚠️ kyc.controller not found:', error.message);
    kycController = {
        submitKYC: (req, res) => res.status(501).json({ status: 'error', message: 'KYC controller not implemented' }),
        getKYCStatus: (req, res) => res.status(501).json({ status: 'error', message: 'KYC controller not implemented' }),
        approveKYC: (req, res) => res.status(501).json({ status: 'error', message: 'KYC controller not implemented' }),
        rejectKYC: (req, res) => res.status(501).json({ status: 'error', message: 'KYC controller not implemented' })
    };
}

try {
    const authMiddleware = require('../middleware/auth.middleware');
    authenticateToken = authMiddleware.authenticateToken || ((req, res, next) => next());
} catch (error) {
    console.error('⚠️ auth.middleware not found:', error.message);
    authenticateToken = (req, res, next) => next();
}

router.post('/kyc', authenticateToken, kycController.submitKYC);
router.get('/kyc', authenticateToken, kycController.getKYCStatus);
router.put('/kyc/:userId/approve', authenticateToken, kycController.approveKYC);
router.put('/kyc/:userId/reject', authenticateToken, kycController.rejectKYC);

router.get('/test', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'User routes are working!',
        routes: ['POST /kyc', 'GET /kyc', 'PUT /kyc/:userId/approve', 'PUT /kyc/:userId/reject']
    });
});

module.exports = router;
