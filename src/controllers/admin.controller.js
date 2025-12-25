const db = require('../../config/db');

console.log('🎯 ADMIN CONTROLLER LOADED - NEW VERSION'); // ← ADD THIS LINE

/**
 * Get Dashboard Stats
 */
exports.getDashboardStats = async (req, res) => {
    try {
        // Total users
        const usersResult = await db.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = usersResult.rows[0].count;

        // Pending KYC
        const pendingKYCResult = await db.query(
            "SELECT COUNT(*) as count FROM users WHERE kyc_status = 'pending'"
        );
        const pendingKYC = pendingKYCResult.rows[0].count;

        // Total transactions
        const transactionsResult = await db.query('SELECT COUNT(*) as count FROM transactions');
        const totalTransactions = transactionsResult.rows[0].count;

        // Total revenue (sum of fees - 1% of completed transactions)
        const revenueResult = await db.query(
            "SELECT SUM(amount * 0.01) as revenue FROM transactions WHERE status = 'completed' AND type IN ('swap', 'withdraw')"
        );
        const totalRevenue = revenueResult.rows[0].revenue || 0;

        console.log('✅ Dashboard stats loaded');

        res.status(200).json({
            status: 'success',
            data: {
                totalUsers: parseInt(totalUsers),
                pendingKYC: parseInt(pendingKYC),
                totalTransactions: parseInt(totalTransactions),
                totalRevenue: parseFloat(totalRevenue)
            }
        });

    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load dashboard stats',
            error: error.message
        });
    }
};

/**
 * Get All KYC Submissions
 */
exports.getAllKYC = async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT 
                users.id as user_id,
                users.first_name,
                users.last_name,
                users.email,
                users.phone,
                users.kyc_status,
                users.kyc_verified,
                kyc_data.fullname,
                kyc_data.dob,
                kyc_data.address,
                kyc_data.id_type,
                kyc_data.id_number,
                kyc_data.bvn,
                kyc_data.kyc_submitted_at,
                kyc_data.kyc_approved_at,
                kyc_data.kyc_rejection_reason
            FROM users
            LEFT JOIN kyc_data ON users.id = kyc_data.user_id
            WHERE kyc_data.id IS NOT NULL
        `;

        const params = [];

        if (status && status !== 'all') {
            query += ' AND users.kyc_status = $1';
            params.push(status);
        }

        query += ' ORDER BY kyc_data.kyc_submitted_at DESC';

        const result = await db.query(query, params);

        console.log(`✅ Loaded ${result.rows.length} KYC submissions`);

        res.status(200).json({
            status: 'success',
            data: result.rows
        });

    } catch (error) {
        console.error('❌ Get KYC error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load KYC data',
            error: error.message
        });
    }
};

/**
 * Get KYC Details
 */
exports.getKYCDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await db.query(
            `SELECT 
                users.id,
                users.first_name,
                users.last_name,
                users.email,
                users.phone,
                users.kyc_status,
                users.kyc_verified,
                users.created_at,
                kyc_data.fullname,
                kyc_data.dob,
                kyc_data.address,
                kyc_data.id_type,
                kyc_data.id_number,
                kyc_data.bvn,
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

        console.log(`✅ Loaded KYC details for user ${userId}`);

        res.status(200).json({
            status: 'success',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Get KYC details error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load KYC details',
            error: error.message
        });
    }
};

/**
 * Approve KYC
 */
exports.approveKYC = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if user exists
        const userCheck = await db.query('SELECT id, kyc_status FROM users WHERE id = $1', [userId]);
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Update user status
        await db.query(
            `UPDATE users 
             SET kyc_status = 'approved', kyc_verified = TRUE 
             WHERE id = $1`,
            [userId]
        );

        // Update KYC data
        await db.query(
            `UPDATE kyc_data 
             SET kyc_approved_at = CURRENT_TIMESTAMP 
             WHERE user_id = $1`,
            [userId]
        );

        console.log(`✅ KYC approved for user ${userId}`);

        res.status(200).json({
            status: 'success',
            message: 'KYC approved successfully'
        });

    } catch (error) {
        console.error('❌ Approve KYC error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to approve KYC',
            error: error.message
        });
    }
};

/**
 * Reject KYC
 */
exports.rejectKYC = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                status: 'error',
                message: 'Rejection reason is required'
            });
        }

        // Check if user exists
        const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Update user status
        await db.query(
            `UPDATE users 
             SET kyc_status = 'rejected', kyc_verified = FALSE 
             WHERE id = $1`,
            [userId]
        );

        // Update KYC data with rejection reason
        await db.query(
            `UPDATE kyc_data 
             SET kyc_rejection_reason = $1 
             WHERE user_id = $2`,
            [reason, userId]
        );

        console.log(`❌ KYC rejected for user ${userId}: ${reason}`);

        res.status(200).json({
            status: 'success',
            message: 'KYC rejected successfully'
        });

    } catch (error) {
        console.error('❌ Reject KYC error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to reject KYC',
            error: error.message
        });
    }
};

/**
 * Get All Users
 */
exports.getAllUsers = async (req, res) => {
    try {
        const { search, kycStatus } = req.query;

        let query = `
            SELECT 
                users.id, 
                users.first_name, 
                users.last_name, 
                users.email, 
                users.phone, 
                users.kyc_verified, 
                users.kyc_status, 
                users.created_at,
                (SELECT SUM(balance) FROM wallets WHERE user_id = users.id) as total_balance
            FROM users
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            query += ` AND (LOWER(email) LIKE LOWER($${paramCount}) OR LOWER(first_name) LIKE LOWER($${paramCount}) OR LOWER(last_name) LIKE LOWER($${paramCount}))`;
            params.push(`%${search}%`);
        }

        if (kycStatus && kycStatus !== 'all') {
            paramCount++;
            query += ` AND kyc_status = $${paramCount}`;
            params.push(kycStatus);
        }

        query += ' ORDER BY created_at DESC LIMIT 100';

        const result = await db.query(query, params);

        console.log(`✅ Loaded ${result.rows.length} users`);

        res.status(200).json({
            status: 'success',
            data: result.rows
        });

    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load users',
            error: error.message
        });
    }
};

/**
 * Get User Details
 */
exports.getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        // Get user info
        const userResult = await db.query(
            `SELECT 
                id, first_name, last_name, email, phone, 
                kyc_verified, kyc_status, created_at
            FROM users 
            WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];

        // Get wallets
        const walletsResult = await db.query(
            'SELECT currency, balance FROM wallets WHERE user_id = $1',
            [userId]
        );

        // Get recent transactions
        const transactionsResult = await db.query(
            `SELECT * FROM transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 10`,
            [userId]
        );

        console.log(`✅ Loaded details for user ${userId}`);

        res.status(200).json({
            status: 'success',
            data: {
                user,
                wallets: walletsResult.rows,
                recentTransactions: transactionsResult.rows
            }
        });

    } catch (error) {
        console.error('❌ Get user details error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load user details',
            error: error.message
        });
    }
};

/**
 * Block User
 */
exports.blockUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Add blocked column if it doesn't exist
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE
        `);

        await db.query(
            'UPDATE users SET blocked = TRUE WHERE id = $1',
            [userId]
        );

        console.log(`🚫 User ${userId} blocked`);

        res.status(200).json({
            status: 'success',
            message: 'User blocked successfully'
        });

    } catch (error) {
        console.error('❌ Block user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to block user',
            error: error.message
        });
    }
};

/**
 * Unblock User
 */
exports.unblockUser = async (req, res) => {
    try {
        const { userId } = req.params;

        await db.query(
            'UPDATE users SET blocked = FALSE WHERE id = $1',
            [userId]
        );

        console.log(`✅ User ${userId} unblocked`);

        res.status(200).json({
            status: 'success',
            message: 'User unblocked successfully'
        });

    } catch (error) {
        console.error('❌ Unblock user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to unblock user',
            error: error.message
        });
    }
};

/**
 * Get All Transactions
 */
exports.getAllTransactions = async (req, res) => {
    try {
        const { type, status, search } = req.query;

        let query = `
            SELECT 
                transactions.*,
                users.email as user_email,
                users.first_name,
                users.last_name
            FROM transactions
            LEFT JOIN users ON transactions.user_id = users.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 0;

        if (type && type !== 'all') {
            paramCount++;
            query += ` AND transactions.type = $${paramCount}`;
            params.push(type);
        }

        if (status && status !== 'all') {
            paramCount++;
            query += ` AND transactions.status = $${paramCount}`;
            params.push(status);
        }

        if (search) {
            paramCount++;
            query += ` AND (LOWER(users.email) LIKE LOWER($${paramCount}) OR CAST(transactions.reference AS TEXT) LIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        query += ' ORDER BY transactions.created_at DESC LIMIT 100';

        const result = await db.query(query, params);

        console.log(`✅ Loaded ${result.rows.length} transactions`);

        res.status(200).json({
            status: 'success',
            data: result.rows
        });

    } catch (error) {
        console.error('❌ Get transactions error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load transactions',
            error: error.message
        });
    }
};

// DO NOT USE module.exports = exports; 
// Just leave it as is - Node.js will handle it correctly
