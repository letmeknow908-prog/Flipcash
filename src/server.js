const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============ CRITICAL ERROR HANDLING ============
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error);
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
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
    uptime: process.uptime(),
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
    console.log(`⚠️ Route not found: ${route.file} (skipping) - ${error.message}`);
    console.error(error.stack); // Log the stack trace
  }
});

// RATE ROUTES - Built-in (always works!)
try {
  const rateController = require('./controllers/rate.controller');
  
  app.get(`/api/${API_VERSION}/rates`, async (req, res, next) => {
    try {
      await rateController.getRates(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  
  app.get(`/api/${API_VERSION}/rates/history`, async (req, res, next) => {
    try {
      await rateController.getRateHistory(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  
  app.post(`/api/${API_VERSION}/rates/calculate`, async (req, res, next) => {
    try {
      await rateController.calculateConversion(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  
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

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'FlipCash API',
    version: '4.0.4',
    api: `/api/${API_VERSION}`,
    health: '/health',
    status: 'operational'
  });
});

// Error handling
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err.message);
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
let server;
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
      console.log('👋 Graceful shutdown complete');
      process.exit(0);
    });
    
    setTimeout(() => {
      console.error('❌ Could not close connections in time, forcing shutdown');
      process.exit(1);
    }, 8000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting FlipCash API server...');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Port: ${PORT}`);
    
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 FlipCash API running on port ${PORT}`);
      console.log(`🌐 API Base: http://localhost:${PORT}/api/${API_VERSION}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log('='.repeat(50));
      console.log('✅ Server ready and stable!');
    });
    
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use`);
        process.exit(1);
      }
    });
    
    return server;
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer().catch(error => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  });
}

module.exports = { app, startServer };
