const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../../config/db');

console.log('🔧 WALLET ROUTES FILE LOADED - NEW VERSION WITH DB QUERY');

router.get('/', authMiddleware, async (req, res) => {
    console.log('🚨 WALLET ROUTE HANDLER CALLED!');
    
    try {
        const userId = req.user.id;
        console.log('🔍 Fetching wallets for user ID:', userId);
        
        const result = await db.query(
            'SELECT currency, balance FROM wallets WHERE user_id = $1 ORDER BY currency',
            [userId]
        );
        
        console.log('📊 Database returned:', result.rows.length, 'wallets');
        console.log('💰 Wallet data:', JSON.stringify(result.rows));
        
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

console.log('✅ Wallet routes loaded - WITH DATABASE QUERY');
module.exports = router;
