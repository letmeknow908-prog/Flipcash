const db = require('../../config/db');

// Dashboard Stats
exports.getDashboardStats = async (req, res) => {
    try {
        console.log('📊 Fetching dashboard stats...');
        
        // Total users
        const usersResult = await db.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(usersResult.rows[0].count);
        
        // Pending KYC
        const kycResult = await db.query("SELECT COUNT(*) as count FROM users WHERE kyc_status = 'pending'");
        const pendingKYC = parseInt(kycResult.rows[0].count);
        
        // Total transactions
        const txResult = await db.query('SELECT COUNT(*) as count FROM transactions');
        const totalTransactions = parseInt(txResult.rows[0].count);
        
        // Total revenue (sum of all transaction fees)
        const revenueResult = await db.query("SELECT SUM(amount * 0.01) as revenue FROM transactions WHERE status = 'completed'");
        const totalRevenue = parseFloat(revenueResult.rows[0].revenue || 0);
        
        console.log('✅ Stats loaded:', { totalUsers, pendingKYC, totalTransactions, totalRevenue });
        
        res.json({
            status: 'success',
            data: {
                totalUsers,
                pendingKYC,
                totalTransactions,
                totalRevenue
            }
        });
    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load dashboard stats'
        });
    }
};

// Get All KYC Submissions
exports.getAllKYC = async (req, res) => {
    try {
        const { status } = req.query;
        
        let query = `
            SELECT 
                u.id as user_id,
                u.email,
                u.phone,
                u.kyc_status,
                k.fullname,
                k.dob,
                k.address,
                k.id_type,
                k.id_number,
                k.bvn,
                k.kyc_submitted_at,
                k.kyc_approved_at,
                k.kyc_rejection_reason
            FROM users u
            LEFT JOIN kyc_data k ON u.id = k.user_id
            WHERE k.id IS NOT NULL
        `;
        
        if (status && status !== 'all') {
            query += ` AND u.kyc_status = $1`;
        }
        
        query += ' ORDER BY k.kyc_submitted_at DESC';
        
        const result = status && status !== 'all' 
            ? await db.query(query, [status])
            : await db.query(query);
        
        console.log(`✅ Loaded ${result.rows.length} KYC submissions`);
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Get KYC error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load KYC submissions'
        });
    }
};

// Get KYC Details for a User
exports.getKYCDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await db.query(`
            SELECT 
                u.id as user_id,
                u.email,
                u.phone,
                u.kyc_status,
                k.*
            FROM users u
            LEFT JOIN kyc_data k ON u.id = k.user_id
            WHERE u.id = $1
        `, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
        
        res.json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Get KYC details error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load KYC details'
        });
    }
};

// Approve KYC
exports.approveKYC = async (req, res) => {
    try {
        const { userId } = req.params;
        
        await db.query(`
            UPDATE users 
            SET kyc_status = 'approved', 
                kyc_verified = true 
            WHERE id = $1
        `, [userId]);
        
        await db.query(`
            UPDATE kyc_data 
            SET kyc_approved_at = NOW() 
            WHERE user_id = $1
        `, [userId]);
        
        console.log(`✅ KYC approved for user ${userId}`);
        
        res.json({
            status: 'success',
            message: 'KYC approved successfully'
        });
    } catch (error) {
        console.error('❌ Approve KYC error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to approve KYC'
        });
    }
};

// Reject KYC
exports.rejectKYC = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        
        await db.query(`
            UPDATE users 
            SET kyc_status = 'rejected', 
                kyc_verified = false 
            WHERE id = $1
        `, [userId]);
        
        await db.query(`
            UPDATE kyc_data 
            SET kyc_rejection_reason = $1 
            WHERE user_id = $2
        `, [reason, userId]);
        
        console.log(`❌ KYC rejected for user ${userId}`);
        
        res.json({
            status: 'success',
            message: 'KYC rejected successfully'
        });
    } catch (error) {
        console.error('❌ Reject KYC error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to reject KYC'
        });
    }
};

// Get All Users
exports.getAllUsers = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                id,
                first_name,
                last_name,
                email,
                phone,
                kyc_status,
                kyc_verified,
                created_at
            FROM users
            ORDER BY created_at DESC
        `);
        
        console.log(`✅ Loaded ${result.rows.length} users`);
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load users'
        });
    }
};

// Get User Details
exports.getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await db.query(`
            SELECT * FROM users WHERE id = $1
        `, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }
        
        res.json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Get user details error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load user details'
        });
    }
};

// Block User
exports.blockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        await db.query(`
            UPDATE users 
            SET is_blocked = true 
            WHERE id = $1
        `, [userId]);
        
        res.json({
            status: 'success',
            message: 'User blocked successfully'
        });
    } catch (error) {
        console.error('❌ Block user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to block user'
        });
    }
};

// Unblock User
exports.unblockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        await db.query(`
            UPDATE users 
            SET is_blocked = false 
            WHERE id = $1
        `, [userId]);
        
        res.json({
            status: 'success',
            message: 'User unblocked successfully'
        });
    } catch (error) {
        console.error('❌ Unblock user error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to unblock user'
        });
    }
};

// Get All Transactions
exports.getAllTransactions = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                t.*,
                u.email as user_email,
                u.first_name,
                u.last_name
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
            LIMIT 100
        `);
        
        console.log(`✅ Loaded ${result.rows.length} transactions`);
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Get transactions error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to load transactions'
        });
    }
};

console.log('🎯 ADMIN CONTROLLER LOADED - ABSOLUTE FINAL VERSION');
