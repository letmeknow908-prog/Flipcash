const db = require('../../config/db');

// Submit KYC
exports.submitKYC = async (req, res) => {
    try {
        const userId = req.user.id;
        const { fullname, dob, address, idType, idNumber, bvn } = req.body;

        // Validate required fields
        if (!fullname || !dob || !address || !idType || !idNumber) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide all required fields'
            });
        }

        // Validate age (18+)
        const birthDate = new Date(dob);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        if (age < 18) {
            return res.status(400).json({
                status: 'error',
                message: 'You must be at least 18 years old'
            });
        }

        // Check if KYC already exists
        const existing = await db.query(
            'SELECT id FROM kyc_data WHERE user_id = $1',
            [userId]
        );

        if (existing.rows.length > 0) {
            // Update existing KYC
            await db.query(
                `UPDATE kyc_data 
                 SET fullname = $1, dob = $2, address = $3, id_type = $4, 
                     id_number = $5, bvn = $6, kyc_submitted_at = CURRENT_TIMESTAMP
                 WHERE user_id = $7`,
                [fullname, dob, address, idType, idNumber, bvn, userId]
            );
        } else {
            // Insert new KYC
            await db.query(
                `INSERT INTO kyc_data (user_id, fullname, dob, address, id_type, id_number, bvn, kyc_submitted_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                [userId, fullname, dob, address, idType, idNumber, bvn]
            );
        }

        // Update user KYC status
        await db.query(
            `UPDATE users SET kyc_status = 'pending' WHERE id = $1`,
            [userId]
        );

        console.log(`✅ KYC submitted for user ${userId}`);

        res.status(200).json({
            status: 'success',
            message: 'KYC submitted successfully. Verification under review.',
            data: {
                kycStatus: 'pending',
                kycVerified: false
            }
        });

    } catch (error) {
        console.error('❌ KYC submission error:', error);
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

        // Get user KYC status
        const userResult = await db.query(
            'SELECT kyc_status, kyc_verified FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];

        // Get KYC data
        const kycResult = await db.query(
            'SELECT * FROM kyc_data WHERE user_id = $1',
            [userId]
        );

        const kycData = kycResult.rows.length > 0 ? kycResult.rows[0] : null;

        res.status(200).json({
            status: 'success',
            data: {
                kycStatus: user.kyc_status,
                kycVerified: user.kyc_verified,
                kycSubmittedAt: kycData?.kyc_submitted_at,
                fullname: kycData?.fullname,
                dob: kycData?.dob,
                address: kycData?.address,
                idType: kycData?.id_type,
                idNumber: kycData?.id_number,
                bvn: kycData?.bvn
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

// Approve KYC (Admin)
exports.approveKYC = async (req, res) => {
    try {
        const { userId } = req.params;

        await db.query(
            `UPDATE users SET kyc_status = 'approved', kyc_verified = TRUE WHERE id = $1`,
            [userId]
        );

        await db.query(
            `UPDATE kyc_data SET kyc_approved_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
            [userId]
        );

        console.log(`✅ KYC approved for user ${userId}`);

        res.status(200).json({
            status: 'success',
            message: 'KYC approved successfully'
        });

    } catch (error) {
        console.error('❌ KYC approval error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to approve KYC',
            error: error.message
        });
    }
};

// Reject KYC (Admin)
exports.rejectKYC = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        await db.query(
            `UPDATE users SET kyc_status = 'rejected', kyc_verified = FALSE WHERE id = $1`,
            [userId]
        );

        await db.query(
            `UPDATE kyc_data SET kyc_rejection_reason = $1 WHERE user_id = $2`,
            [reason, userId]
        );

        console.log(`❌ KYC rejected for user ${userId}`);

        res.status(200).json({
            status: 'success',
            message: 'KYC rejected'
        });

    } catch (error) {
        console.error('❌ KYC rejection error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to reject KYC',
            error: error.message
        });
    }
};

module.exports = exports;
