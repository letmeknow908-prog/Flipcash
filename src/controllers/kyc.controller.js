// src/controllers/kyc.controller.js
const db = require('../config/database'); // PostgreSQL connection
const redis = require('../config/redis'); // Redis connection for caching
const { validationResult } = require('express-validator');
const crypto = require('crypto');

// Cache expiration times (in seconds)
const CACHE_TTL = {
    KYC_STATUS: 300, // 5 minutes
    KYC_SUBMISSION: 1800, // 30 minutes
    USER_KYC: 900 // 15 minutes
};

// Helper function to generate KYC reference ID
const generateKYCReference = () => {
    return `KYC-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

// Main KYC submission endpoint
exports.submitKYC = async (req, res) => {
    const transaction = await db.query('BEGIN'); // Start transaction
    
    try {
        // Check validation errors from middleware
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            await db.query('ROLLBACK');
            return res.status(400).json({ 
                status: 'error', 
                errors: errors.array(),
                message: 'Validation failed'
            });
        }

        const userId = req.user.id;
        const userEmail = req.user.email; // Assuming email in token
        
        const { 
            fullname, dob, address, idType, idNumber, bvn,
            country, occupation, sourceFunds 
        } = req.body;

        console.log(`KYC Submission for User ${userId} (${userEmail})`);

        // Check if KYC already submitted
        const existingKYC = await db.query(
            'SELECT id, status FROM kyc_submissions WHERE user_id = $1 AND status != $2',
            [userId, 'rejected']
        );

        if (existingKYC.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: 'KYC already submitted',
                data: { 
                    currentStatus: existingKYC.rows[0].status,
                    submissionId: existingKYC.rows[0].id
                }
            });
        }

        // Generate KYC reference
        const kycReference = generateKYCReference();

        // Insert KYC data into database with transaction safety
        const insertQuery = `
            INSERT INTO kyc_submissions 
            (user_id, reference_id, fullname, dob, address, id_type, id_number, bvn, 
             country, occupation, source_funds, status, submitted_at, email, is_bvn_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14)
            RETURNING id, reference_id, submitted_at, status;
        `;
        
        const insertValues = [
            userId, kycReference, fullname, new Date(dob), address, 
            idType.toUpperCase(), idNumber, bvn, country.toUpperCase(), 
            occupation, sourceFunds.toUpperCase(), 'pending', userEmail, false
        ];

        // Execute KYC submission query
        const kycResult = await db.query(insertQuery, insertValues);
        const kycRecord = kycResult.rows[0];

        // Update user's KYC status in users table
        await db.query(
            `UPDATE users 
             SET kyc_status = $1, 
                 kyc_submitted_at = NOW(),
                 full_name = $2,
                 date_of_birth = $3,
                 bvn = $4
             WHERE id = $5`,
            ['pending', fullname, new Date(dob), bvn, userId]
        );

        // Invalidate KYC cache for this user
        await redis.del(`kyc:status:${userId}`);
        await redis.del(`user:kyc:${userId}`);

        // Commit transaction
        await db.query('COMMIT');

        // Log successful submission
        console.log(`KYC submitted successfully: ${kycReference} for User ${userId}`);

        // Send success response
        res.status(201).json({
            status: 'success',
            message: 'KYC submitted successfully and is under review',
            data: {
                submissionId: kycRecord.id,
                referenceId: kycRecord.reference_id,
                kycStatus: kycRecord.status,
                submittedAt: kycRecord.submitted_at,
                estimatedReviewTime: '24-48 hours',
                nextSteps: [
                    'Your KYC is now in review queue',
                    'You will receive email notifications',
                    'Check status in dashboard'
                ]
            }
        });

    } catch (error) {
        // Rollback transaction on error
        await db.query('ROLLBACK');
        
        console.error('KYC submission error:', error);
        
        // Handle specific database errors
        if (error.code === '23505') { // PostgreSQL unique violation
            return res.status(400).json({
                status: 'error',
                message: 'Duplicate submission detected',
                code: 'DUPLICATE_KYC'
            });
        }
        
        if (error.code === '23503') { // Foreign key violation
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Generic error response
        res.status(500).json({
            status: 'error',
            message: 'Internal server error during KYC submission',
            code: 'KYC_SUBMISSION_FAILED',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
};

// Get KYC status for current user (with Redis caching)
exports.getKYCStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const cacheKey = `kyc:status:${userId}`;

        // Try to get from Redis cache first
        const cachedStatus = await redis.get(cacheKey);
        if (cachedStatus) {
            return res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedStatus),
                source: 'cache'
            });
        }

        // Query database
        const query = `
            SELECT 
                ks.status as kyc_status,
                ks.reference_id,
                ks.submitted_at,
                ks.reviewed_at,
                ks.rejection_reason,
                ks.fullname,
                ks.id_type,
                ks.id_number,
                ks.country,
                u.kyc_verified,
                u.kyc_submitted_at,
                u.full_name,
                u.date_of_birth,
                CASE 
                    WHEN ks.status = 'pending' THEN 'Under Review'
                    WHEN ks.status = 'approved' THEN 'Verified'
                    WHEN ks.status = 'rejected' THEN 'Rejected'
                    ELSE 'Not Submitted'
                END as status_display
            FROM users u
            LEFT JOIN kyc_submissions ks ON u.id = ks.user_id AND ks.status != 'rejected'
            WHERE u.id = $1
            ORDER BY ks.submitted_at DESC
            LIMIT 1;
        `;

        const result = await db.query(query, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: {
                    kycStatus: 'not_submitted',
                    kycVerified: false,
                    statusDisplay: 'Not Submitted',
                    nextAction: 'Complete KYC verification'
                }
            });
        }

        const kycData = result.rows[0];
        const responseData = {
            kycStatus: kycData.kyc_status || 'not_submitted',
            kycVerified: kycData.kyc_verified || false,
            referenceId: kycData.reference_id,
            submittedAt: kycData.submitted_at,
            reviewedAt: kycData.reviewed_at,
            rejectionReason: kycData.rejection_reason,
            fullName: kycData.fullname || kycData.full_name,
            idType: kycData.id_type,
            idNumber: kycData.id_number ? `${kycData.id_number.substring(0, 3)}***${kycData.id_number.substring(kycData.id_number.length - 3)}` : null,
            country: kycData.country,
            statusDisplay: kycData.status_display,
            canResubmit: kycData.kyc_status === 'rejected'
        };

        // Cache the result
        await redis.setex(cacheKey, CACHE_TTL.KYC_STATUS, JSON.stringify(responseData));

        res.status(200).json({
            status: 'success',
            data: responseData,
            source: 'database'
        });

    } catch (error) {
        console.error('Get KYC status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve KYC status',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
};

// Get KYC details (for user profile/settings)
exports.getKYCDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const cacheKey = `user:kyc:${userId}`;

        // Try cache first
        const cachedDetails = await redis.get(cacheKey);
        if (cachedDetails) {
            return res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedDetails),
                source: 'cache'
            });
        }

        const query = `
            SELECT 
                fullname, dob, address, id_type, id_number, bvn,
                country, occupation, source_funds, status,
                submitted_at, reviewed_at, reference_id
            FROM kyc_submissions 
            WHERE user_id = $1 
            ORDER BY submitted_at DESC 
            LIMIT 1;
        `;

        const result = await db.query(query, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'No KYC submission found'
            });
        }

        const kycDetails = result.rows[0];
        
        // Mask sensitive information
        const maskedData = {
            ...kycDetails,
            idNumber: kycDetails.id_number ? 
                `${kycDetails.id_number.substring(0, 3)}***${kycDetails.id_number.substring(kycDetails.id_number.length - 3)}` : null,
            bvn: kycDetails.bvn ? 
                `${kycDetails.bvn.substring(0, 3)}*****${kycDetails.bvn.substring(kycDetails.bvn.length - 3)}` : null,
            address: kycDetails.address ? 
                `${kycDetails.address.substring(0, 20)}...` : null
        };

        // Cache for 15 minutes
        await redis.setex(cacheKey, CACHE_TTL.USER_KYC, JSON.stringify(maskedData));

        res.status(200).json({
            status: 'success',
            data: maskedData,
            source: 'database'
        });

    } catch (error) {
        console.error('Get KYC details error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve KYC details'
        });
    }
};

// Admin: Get all pending KYC submissions
exports.getPendingSubmissions = async (req, res) => {
    try {
        // Check if user is admin (add your admin check logic)
        const isAdmin = req.user.role === 'admin';
        if (!isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'Admin access required'
            });
        }

        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const query = `
            SELECT 
                ks.id, ks.reference_id, ks.user_id, ks.fullname, 
                ks.id_type, ks.id_number, ks.country, ks.submitted_at,
                u.email, u.phone, u.created_at as user_joined
            FROM kyc_submissions ks
            JOIN users u ON ks.user_id = u.id
            WHERE ks.status = 'pending'
            ORDER BY ks.submitted_at ASC
            LIMIT $1 OFFSET $2;
        `;

        const countQuery = `SELECT COUNT(*) FROM kyc_submissions WHERE status = 'pending'`;

        const [results, countResult] = await Promise.all([
            db.query(query, [limit, offset]),
            db.query(countQuery)
        ]);

        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            status: 'success',
            data: {
                submissions: results.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Get pending KYC error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve pending submissions'
        });
    }
};

// Admin: Approve KYC
exports.approveKYC = async (req, res) => {
    const transaction = await db.query('BEGIN');
    
    try {
        const { userId } = req.params;
        const adminId = req.user.id;

        // Check if admin
        const isAdmin = req.user.role === 'admin';
        if (!isAdmin) {
            await db.query('ROLLBACK');
            return res.status(403).json({
                status: 'error',
                message: 'Admin access required'
            });
        }

        // Get KYC submission
        const kycQuery = `SELECT * FROM kyc_submissions WHERE user_id = $1 AND status = 'pending'`;
        const kycResult = await db.query(kycQuery, [userId]);
        
        if (kycResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({
                status: 'error',
                message: 'No pending KYC submission found for this user'
            });
        }

        const kycSubmission = kycResult.rows[0];

        // Update KYC status
        await db.query(
            `UPDATE kyc_submissions 
             SET status = 'approved', 
                 reviewed_at = NOW(),
                 reviewer_id = $1,
                 is_bvn_verified = true
             WHERE user_id = $2 AND status = 'pending'`,
            [adminId, userId]
        );

        // Update user KYC status
        await db.query(
            `UPDATE users 
             SET kyc_status = 'approved', 
                 kyc_verified = true,
                 kyc_verified_at = NOW(),
                 tier_level = 'verified'
             WHERE id = $1`,
            [userId]
        );

        // Invalidate caches
        await Promise.all([
            redis.del(`kyc:status:${userId}`),
            redis.del(`user:kyc:${userId}`),
            redis.del('admin:pending:kyc')
        ]);

        await db.query('COMMIT');

        // Log the approval
        console.log(`KYC approved for User ${userId} by Admin ${adminId}`);

        res.status(200).json({
            status: 'success',
            message: 'KYC approved successfully',
            data: {
                userId,
                referenceId: kycSubmission.reference_id,
                approvedAt: new Date().toISOString(),
                reviewerId: adminId,
                userTier: 'verified'
            }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('KYC approval error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to approve KYC'
        });
    }
};

// Admin: Reject KYC
exports.rejectKYC = async (req, res) => {
    const transaction = await db.query('BEGIN');
    
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        const adminId = req.user.id;

        if (!reason || reason.trim().length < 10) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: 'Rejection reason must be at least 10 characters'
            });
        }

        // Check if admin
        const isAdmin = req.user.role === 'admin';
        if (!isAdmin) {
            await db.query('ROLLBACK');
            return res.status(403).json({
                status: 'error',
                message: 'Admin access required'
            });
        }

        // Get KYC submission
        const kycQuery = `SELECT * FROM kyc_submissions WHERE user_id = $1 AND status = 'pending'`;
        const kycResult = await db.query(kycQuery, [userId]);
        
        if (kycResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({
                status: 'error',
                message: 'No pending KYC submission found for this user'
            });
        }

        const kycSubmission = kycResult.rows[0];

        // Update KYC status
        await db.query(
            `UPDATE kyc_submissions 
             SET status = 'rejected', 
                 reviewed_at = NOW(),
                 reviewer_id = $1,
                 rejection_reason = $2
             WHERE user_id = $3 AND status = 'pending'`,
            [adminId, reason.trim(), userId]
        );

        // Update user KYC status
        await db.query(
            `UPDATE users 
             SET kyc_status = 'rejected',
                 kyc_rejection_reason = $1
             WHERE id = $2`,
            [reason.trim(), userId]
        );

        // Invalidate caches
        await Promise.all([
            redis.del(`kyc:status:${userId}`),
            redis.del(`user:kyc:${userId}`),
            redis.del('admin:pending:kyc')
        ]);

        await db.query('COMMIT');

        // Log the rejection
        console.log(`KYC rejected for User ${userId} by Admin ${adminId}. Reason: ${reason}`);

        res.status(200).json({
            status: 'success',
            message: 'KYC rejected',
            data: {
                userId,
                referenceId: kycSubmission.reference_id,
                rejectedAt: new Date().toISOString(),
                reviewerId: adminId,
                rejectionReason: reason.trim()
            }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('KYC rejection error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to reject KYC'
        });
    }
};

// Get KYC statistics (for admin dashboard)
exports.getKYCStats = async (req, res) => {
    try {
        const cacheKey = 'kyc:stats:dashboard';
        const cachedStats = await redis.get(cacheKey);
        
        if (cachedStats) {
            return res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedStats),
                source: 'cache'
            });
        }

        const statsQuery = `
            SELECT 
                status,
                COUNT(*) as count,
                DATE(submitted_at) as date
            FROM kyc_submissions
            WHERE submitted_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY status, DATE(submitted_at)
            ORDER BY date DESC, status;
        `;

        const totalQuery = `
            SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
                COUNT(*) as total
            FROM kyc_submissions;
        `;

        const [statsResult, totalResult] = await Promise.all([
            db.query(statsQuery),
            db.query(totalQuery)
        ]);

        const stats = {
            totals: totalResult.rows[0],
            dailyStats: statsResult.rows,
            lastUpdated: new Date().toISOString()
        };

        // Cache for 10 minutes
        await redis.setex(cacheKey, 600, JSON.stringify(stats));

        res.status(200).json({
            status: 'success',
            data: stats,
            source: 'database'
        });

    } catch (error) {
        console.error('Get KYC stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve KYC statistics'
        });
    }
};

module.exports = exports;
