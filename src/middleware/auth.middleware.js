const jwt = require('jsonwebtoken');

exports.authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'Access token required'
            });
        }

        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
            if (err) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Invalid or expired token'
                });
            }

            req.user = user;
            next();
        });

    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Authentication failed',
            error: error.message
        });
    }
};

module.exports = exports;
