const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// Get active broadcast messages
router.get('/active', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, title, message, type, icon, created_at 
             FROM broadcast_messages 
             WHERE active = TRUE 
             AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY created_at DESC 
             LIMIT 5`
        );
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Get broadcast messages error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch messages'
        });
    }
});

module.exports = router;
