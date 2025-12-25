// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // For now, just pass through for testing
  // TODO: Implement proper JWT authentication
  next();
};

module.exports = { authenticateToken };
