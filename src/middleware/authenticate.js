const JWTUtil = require('../utils/jwt');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'No token provided. Please authenticate.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = JWTUtil.verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found. Please authenticate again.',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      kycStatus: user.kyc_status,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token. Please login again.',
    });
  }
};

module.exports = authenticate;
