// UNIVERSAL KYC CONTROLLER - Works with any database setup
// Replace this with your actual database connection method

// If you're using MongoDB/Mongoose, uncomment this:
// const User = require('../models/User');

// If you're using raw SQL/PostgreSQL, you'll use your db connection

exports.submitKYC = async (req, res) => {
    try {
        const userId = req.user.id; // From authentication middleware
        const { fullname, dob, address, idType, idNumber, bvn } = req.body;

        // Validate required fields
        if (!fullname || !dob || !address || !idType || !idNumber) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide all required fields'
            });
        }

        // Validate age (must be 18+)
        const birthDate = new Date(dob);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        if (age < 18) {
            return res.status(400).json({
                status: 'error',
                message: 'You must be at least 18 years old'
            });
        }

        // ============================================
        // OPTION 1: If you're using Mongoose/MongoDB
        // ============================================
        /*
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                fullname,
                dob: new Date(dob),
                address,
                idType,
                idNumber,
                bvn: bvn || null,
                kycStatus: 'pending',
                kycSubmittedAt: new Date()
            },
            { new: true }
        ).select('-password');
        */

        // ============================================
        // OPTION 2: If you're using PostgreSQL/MySQL
        // ============================================
        /*
        const db = require('../config/database'); // Your db connection
        const result = await db.query(
            `UPDATE users SET 
             fullname = $1, 
             dob = $2, 
             address = $3, 
             id_type = $4, 
             id_number = $5, 
             bvn = $6, 
             kyc_status = 'pending', 
             kyc_submitted_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [fullname, dob, address, idType, idNumber, bvn, userId]
        );
        const updatedUser = result.rows[0];
        delete updatedUser.password;
        */

        // ============================================
        // TEMPORARY RESPONSE (until you connect to DB)
        // ============================================
        // For now, just return success
        // You need to actually save to database above
        const updatedUser = {
            id: userId,
            fullname,
            dob,
            address,
            idType,
            idNumber,
            bvn,
            kycStatus: 'pending',
            kycSubmittedAt: new Date()
        };

        res.status(200).json({
            status: 'success',
            message: 'KYC submitted successfully',
            data: updatedUser
        });

    } catch (error) {
        console.error('KYC submission error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to submit KYC',
            error: error.message
        });
    }
};

// Get KYC Status
exports.getKYCStatus = async (req, res) => {
    try {
        const userId = req.user.id;

        // ============================================
        // OPTION 1: Mongoose/MongoDB
        // ============================================
        /*
        const user = await User.findById(userId).select(
            'kycStatus kycVerified kycSubmittedAt fullname dob address idType idNumber bvn'
        );
        */

        // ============================================
        // OPTION 2: PostgreSQL/MySQL
        // ============================================
        /*
        const db = require('../config/database');
        const result = await db.query(
            `SELECT kyc_status, kyc_verified, kyc_submitted_at, 
                    fullname, dob, address, id_type, id_number, bvn
             FROM users WHERE id = $1`,
            [userId]
        );
        const user = result.rows[0];
        */

        // ============================================
        // TEMPORARY RESPONSE
        // ============================================
        const user = {
            kycStatus: 'not_submitted',
            kycVerified: false,
            kycSubmittedAt: null,
            fullname: null,
            dob: null,
            address: null,
            idType: null,
            idNumber: null,
            bvn: null
        };

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: user
        });

    } catch (error) {
        console.error('Get KYC status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get KYC status',
            error: error.message
        });
    }
};

// Admin: Approve KYC
exports.approveKYC = async (req, res) => {
    try {
        const { userId } = req.params;

        // Update user in database
        // (Use your database method here)

        res.status(200).json({
            status: 'success',
            message: 'KYC approved successfully'
        });

    } catch (error) {
        console.error('KYC approval error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to approve KYC',
            error: error.message
        });
    }
};

// Admin: Reject KYC
exports.rejectKYC = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        // Update user in database
        // (Use your database method here)

        res.status(200).json({
            status: 'success',
            message: 'KYC rejected'
        });

    } catch (error) {
        console.error('KYC rejection error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to reject KYC',
            error: error.message
        });
    }
};

module.exports = exports;
