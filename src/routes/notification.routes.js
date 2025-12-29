const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const db = require('../../config/db');

// Get user notifications
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 50, unread_only } = req.query;
        
        let query = `
            SELECT id, type, title, message, read, metadata, created_at 
            FROM notifications 
            WHERE user_id = $1
        `;
        
        if (unread_only === 'true') {
            query += ` AND read = FALSE`;
        }
        
        query += ` ORDER BY created_at DESC LIMIT $2`;
        
        const result = await db.query(query, [userId, limit]);
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch notifications'
        });
    }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;
        
        await db.query(
            `UPDATE notifications 
             SET read = TRUE, read_at = NOW() 
             WHERE id = $1 AND user_id = $2`,
            [notificationId, userId]
        );
        
        res.json({
            status: 'success',
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update notification'
        });
    }
});

// Mark all as read
router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        await db.query(
            `UPDATE notifications 
             SET read = TRUE, read_at = NOW() 
             WHERE user_id = $1 AND read = FALSE`,
            [userId]
        );
        
        res.json({
            status: 'success',
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update notifications'
        });
    }
});

console.log('✅ Notification routes loaded');
module.exports = router;
