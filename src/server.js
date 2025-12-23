const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const walletRoutes = require('./routes/wallet.routes');
const transactionRoutes = require('./routes/transaction.routes');
const rateRoutes = require('./routes/rate.routes');
const webhookRoutes = require('./routes/webhook.routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'FlipCash API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/wallets`, walletRoutes);
app.use(`/api/${API_VERSION}/transactions`, transactionRoutes);
app.use(`/api/${API_VERSION}/rates`, rateRoutes);
app.use(`/api/${API_VERSION}/webhooks`, webhookRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server WITHOUT Redis dependency
const startServer = async () => {
  try {
    console.log('🚀 Starting FlipCash API server...');
    
    // Try to connect to Redis if available, but don't fail if it's not
    try {
      if (process.env.REDIS_URL || process.env.REDIS_HOST) {
        const redis = require('redis');
        const redisClient = redis.createClient({
          url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
        });
        
        redisClient.on('error', (err) => console.log('⚠️ Redis Client Error (continuing without Redis):', err.message));
        redisClient.on('connect', () => console.log('✅ Redis connected'));
        
        await redisClient.connect().catch(err => {
          console.log('⚠️ Redis connection failed (continuing without Redis):', err.message);
        });
      } else {
        console.log('ℹ️ Redis not configured - running without cache');
      }
    } catch (redisError) {
      console.log('⚠️ Redis not available (continuing without Redis):', redisError.message);
    }
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 FlipCash API server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 API Base URL: http://localhost:${PORT}/api/${API_VERSION}`);
      console.log(`✅ Routes registered:`);
      console.log(`   - /api/${API_VERSION}/auth`);
      console.log(`   - /api/${API_VERSION}/users`);
      console.log(`   - /api/${API_VERSION}/wallets`);
      console.log(`   - /api/${API_VERSION}/transactions`);
      console.log(`   - /api/${API_VERSION}/rates`);
      console.log(`   - /api/${API_VERSION}/webhooks`);
      console.log(`✅ Server is ready!`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;
