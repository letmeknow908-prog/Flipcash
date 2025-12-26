const db = require('../../config/db');

const submitKYC = async (req, res) => {
    try {
        // Get user ID from authenticated request
        const userId = req.user?.id || req.user?.userId;
        
        if (!userId) {
            console.log('❌ KYC submission failed: No user ID in request');
            console.log('req.user:', req.user);
            return res.status(401).json({
                status: 'error',
                message: 'User authentication required'
            });
        }

        const {
            fullname,
            dob,
            address,
            idType,
            idNumber,
            bvn
        } = req.body;

        // Validate required fields
        if (!fullname || !dob || !address || !idType || !idNumber || !bvn) {
            return res.status(400).json({
                status: 'error',
                message: 'All KYC fields are required'
            });
        }

        console.log(`📋 KYC submission for user ${userId}`);

        // Check if user already submitted KYC
        const existingKYC = await db.query(
            'SELECT id FROM kyc_data WHERE user_id = $1',
            [userId]
        );

        if (existingKYC.rows.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'KYC already submitted. Please wait for review.'
            });
        }

        // Insert KYC data
        await db.query(
            `INSERT INTO kyc_data 
             (user_id, fullname, dob, address, id_type, id_number, bvn, kyc_submitted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
            [userId, fullname, dob, address, idType, idNumber, bvn]
        );

        // Update user status
        await db.query(
            `UPDATE users 
             SET kyc_status = 'pending' 
             WHERE id = $1`,
            [userId]
        );

        console.log(`✅ KYC submitted for user ${userId}`);

        res.status(200).json({
            status: 'success',
            message: 'KYC submitted successfully. Your application is under review.'
        });

    } catch (error) {
        console.error('❌ KYC submission error:', error);
        res.status(500).json({
            status: 'error',
            message: 'KYC submission failed',
            error: error.message
        });
    }
};

const getKYCStatus = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        
        if (!userId) {
            return res.status(401).json({
                status: 'error',
                message: 'User authentication required'
            });
        }

        const result = await db.query(
            `SELECT 
                users.kyc_status,
                users.kyc_verified,
                kyc_data.kyc_submitted_at,
                kyc_data.kyc_approved_at,
                kyc_data.kyc_rejection_reason
             FROM users
             LEFT JOIN kyc_data ON users.id = kyc_data.user_id
             WHERE users.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const kycStatus = result.rows[0];

        res.status(200).json({
            status: 'success',
            data: {
                kycStatus: kycStatus.kyc_status || 'not_submitted',
                kycVerified: kycStatus.kyc_verified || false,
                submittedAt: kycStatus.kyc_submitted_at,
                approvedAt: kycStatus.kyc_approved_at,
                rejectionReason: kycStatus.kyc_rejection_reason
            }
        });

    } catch (error) {
        console.error('❌ Get KYC status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get KYC status',
            error: error.message
        });
    }
};

// Export correctly
module.exports = {
    submitKYC,
    getKYCStatus
};
