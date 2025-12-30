const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'FlipCash API is running',
        timestamp: new Date().toISOString()
    });
});

// Load routes
console.log('🚀 Starting FlipCash API server...');

const routes = [
    { name: '/api/v1/auth', path: './routes/auth.routes' },
    { name: '/api/v1/users', path: './routes/user.routes' },
    { name: '/api/v1/wallets', path: './routes/wallet.routes' },
    { name: '/api/v1/transactions', path: './routes/transaction.routes' },
    { name: '/api/v1/webhooks', path: './routes/webhook.routes' },
    { name: '/api/v1/admin-auth', path: './routes/admin.auth.routes' },
    { name: '/api/v1/admin', path: './routes/admin.routes' },
    { name: '/api/v1/notifications', path: './routes/notification.routes' }
];

routes.forEach(route => {
    try {
       console.log(`🔍 Attempting to load: ${route.path}`);
       const router = require(route.path);
       app.use(route.name, router);
       console.log(`✅ Loaded route: ${route.name}`);
       } catch (error) {
       console.log(`❌ FAILED to load ${route.path}:`);
       console.log(`   Error: ${error.message}`);
       console.log(`   Stack: ${error.stack}`);
    }
});

// Broadcast routes
const broadcastRoutes = require('./routes/broadcast.routes');
const adminBroadcastRoutes = require('./routes/admin.broadcast.routes');

app.use('/api/v1/broadcasts', broadcastRoutes);
app.use('/api/v1/admin/broadcasts', adminBroadcastRoutes);

// System routes (IP detection)
try {
    const systemRoutes = require('./routes/system.routes');
    app.use('/api/v1/system', systemRoutes);
    console.log('✅ Loaded route: /api/v1/system');
} catch (error) {
    console.log('⚠️ System routes not found');
}

// Built-in rate routes
try {
    const rateRoutes = require('./routes/rate.routes');
    app.use('/api/v1/rates', rateRoutes);
    console.log('✅ Loaded route: /api/v1/rates (built-in)');
} catch (error) {
    console.log('⚠️ Rate routes not found');
}

// Connect to Redis (if available)
try {
    const redis = require('../config/redis');
    console.log('✅ Redis connected');
} catch (error) {
    console.log('⚠️ Redis not available (optional)');
}

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FlipCash API running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 API Base: http://localhost:${PORT}/api/v1`);
    console.log('✅ Server ready!');
});

module.exports = app;
