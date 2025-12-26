const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'Access token required'
            });
        }
        
        jwt.verify(token, process.env.JWT_SECRET || 'flipcash-secret-key-2025', (err, decoded) => {
            if (err) {
                console.log('❌ Token verification failed:', err.message);
                return res.status(403).json({
                    status: 'error',
                    message: 'Invalid or expired token'
                });
            }
            
            // Attach user data to request
            req.user = {
                id: decoded.id || decoded.userId,
                email: decoded.email,
                role: decoded.role,
                isAdmin: decoded.isAdmin || false
            };
            
            console.log('✅ Auth successful for user:', req.user.id);
            next();
        });
    } catch (error) {
        console.error('❌ Authentication error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Authentication failed',
            error: error.message
        });
    }
};

module.exports = authMiddleware;
