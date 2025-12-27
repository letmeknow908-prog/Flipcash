const rateLimit = require('express-rate-limit');

// Password change rate limiter - 3 attempts per 15 minutes
const passwordChangeLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 attempts
    message: {
        status: 'error',
        message: 'Too many password change attempts. Please try again in 15 minutes.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

console.log('✅ Rate limiter middleware loaded');

module.exports = { passwordChangeLimit };
