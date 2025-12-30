const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// Admin middleware (you should have this already)
const adminMiddleware = require('../middleware/admin.middleware');

// Create broadcast message
router.post('/', adminMiddleware, async (req, res) => {
    try {
        const { title, message, type, icon, expiresAt } = req.body;
        const adminId = req.admin.id;
        
        if (!title || !message) {
            return res.status(400).json({
                status: 'error',
                message: 'Title and message are required'
            });
        }
        
        const result = await db.query(
            `INSERT INTO broadcast_messages (title, message, type, icon, created_by, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [title, message, type || 'info', icon || '📢', adminId, expiresAt || null]
        );
        
        res.json({
            status: 'success',
            message: 'Broadcast message created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Create broadcast error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create broadcast message'
        });
    }
});

// Get all broadcast messages (admin only)
router.get('/', adminMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT b.*, u.first_name, u.last_name 
             FROM broadcast_messages b
             LEFT JOIN users u ON b.created_by = u.id
             ORDER BY b.created_at DESC`
        );
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Get broadcasts error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch broadcasts'
        });
    }
});

// Deactivate broadcast
router.delete('/:id', adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.query(
            'UPDATE broadcast_messages SET active = FALSE WHERE id = $1',
            [id]
        );
        
        res.json({
            status: 'success',
            message: 'Broadcast deactivated'
        });
    } catch (error) {
        console.error('❌ Deactivate broadcast error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to deactivate broadcast'
        });
    }
});

module.exports = router;
