const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Submit KYC
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

        // Update user with KYC data
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                fullname,
                dob: new Date(dob),
                address,
                idType,
                idNumber,
                bvn: bvn || null,
                kycStatus: 'pending', // Set to pending for review
                kycSubmittedAt: new Date()
            }
        });

        // Remove sensitive data from response
        const { password, ...userWithoutPassword } = updatedUser;

        res.status(200).json({
            status: 'success',
            message: 'KYC submitted successfully. Your verification is under review.',
            data: userWithoutPassword
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

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                kycStatus: true,
                kycVerified: true,
                kycSubmittedAt: true,
                fullname: true,
                dob: true,
                address: true,
                idType: true,
                idNumber: true,
                bvn: true
            }
        });

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

// Admin: Approve KYC (you can add this later)
exports.approveKYC = async (req, res) => {
    try {
        const { userId } = req.params;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                kycStatus: 'approved',
                kycVerified: true,
                kycApprovedAt: new Date()
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'KYC approved successfully',
            data: { kycStatus: updatedUser.kycStatus, kycVerified: updatedUser.kycVerified }
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

// Admin: Reject KYC (you can add this later)
exports.rejectKYC = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                kycStatus: 'rejected',
                kycVerified: false,
                kycRejectionReason: reason
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'KYC rejected',
            data: { kycStatus: updatedUser.kycStatus }
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
