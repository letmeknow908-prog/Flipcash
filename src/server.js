const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'FlipCash API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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
  { name: '/api/v1/admin', path: './routes/admin.routes' }
];

routes.forEach(route => {
  try {
    const router = require(route.path);
    app.use(route.name, router);
    console.log(`✅ Loaded route: ${route.name}`); // FIXED: Proper template literal
  } catch (error) {
    console.log(`⚠️ Route not found: ${route.path} (skipping)`); // FIXED
  }
});

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
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FlipCash API running on port ${PORT}`); // FIXED
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`); // FIXED
  console.log(`🌐 API Base: http://localhost:${PORT}/api/v1`); // FIXED
  console.log('✅ Server ready!');
  console.log('='.repeat(50));
  console.log('📊 Admin Panel Endpoints:');
  console.log(`   • GET  /api/v1/admin/stats - Dashboard statistics`);
  console.log(`   • GET  /api/v1/admin/users - List all users`);
  console.log(`   • GET  /api/v1/admin/kyc - List KYC submissions`);
  console.log(`   • PUT  /api/v1/admin/kyc/:id/approve - Approve KYC`);
  console.log(`   • PUT  /api/v1/admin/kyc/:id/reject - Reject KYC`);
  console.log('='.repeat(50));
});

module.exports = app;
