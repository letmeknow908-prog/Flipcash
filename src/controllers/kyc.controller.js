// KYC Controller for FlipCash
// This version returns success without database (temporary fix)
// Update with your database later

exports.submitKYC = async (req, res) => {
    try {
        const userId = req.user.id;
        const { fullname, dob, address, idType, idNumber, bvn } = req.body;

        // Validate required fields
        if (!fullname || !dob || !address || !idType || !idNumber) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide all required fields: fullname, dob, address, idType, idNumber'
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

        // TODO: Save to your database here
        // For now, just return success
        const kycData = {
            userId,
            fullname,
            dob,
            address,
            idType,
            idNumber,
            bvn: bvn || null,
            kycStatus: 'pending',
            kycSubmittedAt: new Date().toISOString()
        };

        console.log('KYC submitted:', kycData);

        res.status(200).json({
            status: 'success',
            message: 'KYC submitted successfully. Verification under review.',
            data: {
                kycStatus: 'pending',
                kycVerified: false,
                kycSubmittedAt: kycData.kycSubmittedAt
            }
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

exports.getKYCStatus = async (req, res) => {
    try {
        const userId = req.user.id;

        // TODO: Get from your database
        // For now, return default status
        const kycStatus = {
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

        res.status(200).json({
            status: 'success',
            data: kycStatus
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

exports.approveKYC = async (req, res) => {
    try {
        const { userId } = req.params;

        // TODO: Update in database
        console.log('Approving KYC for user:', userId);

        res.status(200).json({
            status: 'success',
            message: 'KYC approved successfully',
            data: {
                kycStatus: 'approved',
                kycVerified: true
            }
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

exports.rejectKYC = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        // TODO: Update in database
        console.log('Rejecting KYC for user:', userId, 'Reason:', reason);

        res.status(200).json({
            status: 'success',
            message: 'KYC rejected',
            data: {
                kycStatus: 'rejected',
                kycVerified: false
            }
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

