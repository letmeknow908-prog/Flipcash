const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

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

// Try to load route files (optional)
const routes = [
  { path: '/auth', file: './routes/auth.routes' },
  { path: '/users', file: './routes/user.routes' },
  { path: '/wallets', file: './routes/wallet.routes' },
  { path: '/transactions', file: './routes/transaction.routes' },
  { path: '/webhooks', file: './routes/webhook.routes' }
];

routes.forEach(route => {
  try {
    const routeModule = require(route.file);
    app.use(`/api/${API_VERSION}${route.path}`, routeModule);
    console.log(`✅ Loaded route: /api/${API_VERSION}${route.path}`);
  } catch (error) {
    console.log(`⚠️ Route not found: ${route.file} (skipping)`);
  }
});

// RATE ROUTES - Built-in (always works!)
try {
  const rateController = require('./controllers/rate.controller');
  
  // GET /api/v1/rates - Get exchange rates
  app.get(`/api/${API_VERSION}/rates`, async (req, res, next) => {
    try {
      await rateController.getRates(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  
  // GET /api/v1/rates/history - Get rate history
  app.get(`/api/${API_VERSION}/rates/history`, async (req, res, next) => {
    try {
      await rateController.getRateHistory(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  
  // POST /api/v1/rates/calculate - Calculate conversion
  app.post(`/api/${API_VERSION}/rates/calculate`, async (req, res, next) => {
    try {
      await rateController.calculateConversion(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  
  // POST /api/v1/rates/account/generate - Generate virtual account
  app.post(`/api/${API_VERSION}/rates/account/generate`, async (req, res, next) => {
    try {
      await rateController.generateVirtualAccount(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  
  console.log(`✅ Loaded route: /api/${API_VERSION}/rates (built-in)`);
} catch (error) {
  console.log('⚠️ Rate controller not found:', error.message);
}

// Error handling
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting FlipCash API server...');
    
    // Try Redis connection (optional)
    try {
      if (process.env.REDIS_URL) {
        const redis = require('redis');
        const redisClient = redis.createClient({ url: process.env.REDIS_URL });
        redisClient.on('error', (err) => console.log('⚠️ Redis Error:', err.message));
        await redisClient.connect().catch(() => {});
        console.log('✅ Redis connected');
      }
    } catch (e) {
      console.log('ℹ️ Redis not available (continuing)');
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 FlipCash API running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 API Base: http://localhost:${PORT}/api/${API_VERSION}`);
      console.log(`✅ Server ready!`);
    });
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', () => {
  console.log('SIGTERM: closing server');
  process.exit(0);
});

module.exports = app;
