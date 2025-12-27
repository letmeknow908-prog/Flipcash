const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../../config/db');

// ✅ Get user wallets (FIXED - Now fetches from database)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log('🔍 Fetching wallets for user ID:', userId);
        
        // ✅ Query actual database
        const result = await db.query(
            'SELECT currency, balance, created_at, updated_at FROM wallets WHERE user_id = $1 ORDER BY currency',
            [userId]
        );
        
        console.log('📊 Database returned:', result.rows.length, 'wallets');
        console.log('💰 Wallet data:', JSON.stringify(result.rows));
        
        // ✅ Return real data from database
        res.status(200).json({
            status: 'success',
            data: {
                wallets: result.rows
            }
        });
        
    } catch (error) {
        console.error('❌ Get wallets error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get wallets'
        });
    }
});

console.log('✅ Wallet routes loaded');
module.exports = router;
