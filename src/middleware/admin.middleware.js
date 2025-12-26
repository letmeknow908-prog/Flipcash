const jwt = require('jsonwebtoken');
const db = require('../../config/db');

/**
 * Admin authentication middleware
 * Verifies that the request is from a valid admin
 */
const adminMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'Admin authentication required'
            });
        }
        
        // Verify token
        jwt.verify(token, process.env.JWT_SECRET || 'flipcash-secret-key-2025', async (err, decoded) => {
            if (err) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Invalid or expired admin token'
                });
            }
            
            // CRITICAL: Check if token has isAdmin flag
            if (!decoded.isAdmin) {
                console.log(`🚫 Non-admin attempted access: ${decoded.email}`);
                return res.status(403).json({
                    status: 'error',
                    message: 'Admin access required. Regular user tokens cannot access admin endpoints.'
                });
            }
            
            // Verify admin still exists and is active
            try {
                const result = await db.query(
                    'SELECT id, email, is_active FROM admins WHERE id = $1',
                    [decoded.id]
                );
                
                if (result.rows.length === 0) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Admin account not found'
                    });
                }
                
                const admin = result.rows[0];
                
                if (!admin.is_active) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Admin account is disabled'
                    });
                }
                
                // Attach admin data to request
                req.user = decoded;
                req.admin = admin;
                next();
                
            } catch (dbError) {
                console.error('❌ Admin verification error:', dbError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Admin verification failed'
                });
            }
        });
    } catch (error) {
        console.error('❌ Admin middleware error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Authentication failed',
            error: error.message
        });
    }
};

module.exports = adminMiddleware;
