const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const kycController = require('../controllers/kyc.controller');
const db = require('../../config/db');  // ✅ IMPORT DB
const bcrypt = require('bcryptjs');      // ✅ IMPORT BCRYPT

// Health check
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'User routes are working'
    });
});

// ✅ Get user profile (called by frontend as /users/me)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log('🔍 Fetching user profile for ID:', userId);
        
        // Get user basic info
        const userResult = await db.query(
            'SELECT id, first_name, last_name, email, phone, kyc_status, kyc_verified, created_at FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
        
        const user = userResult.rows[0];
        console.log('👤 User found:', { id: user.id, email: user.email, kyc_status: user.kyc_status });
        
        // Get KYC data if exists
        const kycResult = await db.query(
            'SELECT fullname, dob, address, id_type, id_number, bvn, country, occupation, source_funds FROM kyc_data WHERE user_id = $1',
            [userId]
        );
        
        // Merge KYC data if exists
        if (kycResult.rows.length > 0) {
            console.log('📋 KYC data found:', { fullname: kycResult.rows[0].fullname });
            user.kyc_data = kycResult.rows[0];
            // Also add to top level for backward compatibility
            Object.assign(user, kycResult.rows[0]);
        } else {
            console.log('⚠️ No KYC data found for user');
        }
        
        console.log('✅ Returning user data with KYC status:', user.kyc_status);
        
        res.status(200).json({
            status: 'success',
            data: user
        });
    } catch (error) {
        console.error('❌ Get user profile error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get profile'
        });
    }
});

// Keep the old /profile endpoint for backward compatibility
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await db.query(
            'SELECT id, first_name, last_name, email, phone, kyc_status, kyc_verified, created_at FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
        
        res.status(200).json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get profile'
        });
    }
});

// Update user profile
router.put('/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({
                status: 'error',
                message: 'Phone number is required'
            });
        }
        
        await db.query(
            'UPDATE users SET phone = $1 WHERE id = $2',
            [phone, userId]
        );
        
        // Get updated user
        const result = await db.query(
            'SELECT id, first_name, last_name, email, phone, kyc_status, kyc_verified, created_at FROM users WHERE id = $1',
            [userId]
        );
        
        res.status(200).json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update profile'
        });
    }
});

// KYC routes
router.post('/kyc/submit', authMiddleware, kycController.submitKYC);
router.get('/kyc/status', authMiddleware, kycController.getKYCStatus);

// Get user wallets
router.get('/wallets', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await db.query(
            'SELECT currency, balance, created_at FROM wallets WHERE user_id = $1',
            [userId]
        );
        
        res.status(200).json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Get wallets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get wallets'
        });
    }
});

// Get user transactions
router.get('/transactions', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await db.query(
            `SELECT * FROM transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [userId]
        );
        
        res.status(200).json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get transactions'
        });
    }
});

// ✅ SECURE Change Password Endpoint
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        
        // Validate inputs
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Current password and new password are required' 
            });
        }
        
        // ✅ SECURITY: Validate new password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'New password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character' 
            });
        }
        
        // ✅ SECURITY: Check if new password is same as current
        if (currentPassword === newPassword) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'New password must be different from current password' 
            });
        }
        
        // Get user from database
        const userResult = await db.query(
            'SELECT password FROM users WHERE id = $1', 
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'User not found' 
            });
        }
        
        // ✅ SECURITY: Verify current password
        const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password);
        if (!isValid) {
            console.log(`⚠️ Failed password change attempt for user ${userId}`);
            return res.status(401).json({ 
                status: 'error', 
                message: 'Current password is incorrect' 
            });
        }
        
        // Create new password hash
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password in database
        await db.query(
            'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', 
            [hashedPassword, userId]
        );
        
        console.log(`✅ Password changed successfully for user ${userId}`);
        
        res.json({ 
            status: 'success', 
            message: 'Password changed successfully' 
        });
        
    } catch (error) {
        console.error('❌ Change password error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to change password' 
        });
    }
});

console.log('✅ User routes loaded');
module.exports = router;
