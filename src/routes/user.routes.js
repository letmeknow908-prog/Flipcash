const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kyc.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validateKYC } = require('../middleware/kycValidation');

// ============ KYC ROUTES ============
// POST /api/v1/users/kyc - Submit KYC
router.post('/kyc', authenticateToken, validateKYC, kycController.submitKYC);

// GET /api/v1/users/kyc - Get KYC status
router.get('/kyc', authenticateToken, kycController.getKYCStatus);

// GET /api/v1/users/kyc/details - Get detailed KYC info
router.get('/kyc/details', authenticateToken, kycController.getKYCDetails);

// ============ ADMIN KYC ROUTES ============
// GET /api/v1/users/kyc/pending - Get pending KYC submissions (admin)
router.get('/kyc/pending', authenticateToken, kycController.getPendingSubmissions);

// PUT /api/v1/users/kyc/:userId/approve - Approve KYC (admin)
router.put('/kyc/:userId/approve', authenticateToken, kycController.approveKYC);

// PUT /api/v1/users/kyc/:userId/reject - Reject KYC (admin)
router.put('/kyc/:userId/reject', authenticateToken, kycController.rejectKYC);

// ============ USER PROFILE ROUTES ============
// GET /api/v1/users/profile - Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Remove sensitive data
    const safeUser = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      kycStatus: user.kycStatus || 'not_submitted',
      kycVerified: user.kycVerified || false,
      tierLevel: user.tierLevel || 'basic',
      createdAt: user.createdAt,
      walletLimits: {
        dailyLimit: user.kycVerified ? 500000 : 50000,
        monthlyLimit: user.kycVerified ? 10000000 : 1000000
      }
    };
    
    res.status(200).json({
      status: 'success',
      data: safeUser
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch profile'
    });
  }
});

// PUT /api/v1/users/profile - Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { phone } = req.body;
    const userId = req.user.id;
    
    if (!phone || phone.trim().length < 10) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid phone number required'
      });
    }
    
    // Update logic here (you'll need to add your database update)
    // Example: await db.query('UPDATE users SET phone = $1 WHERE id = $2', [phone, userId]);
    
    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { phone }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile'
    });
  }
});

module.exports = router;
