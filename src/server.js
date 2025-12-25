const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg'); // Added PostgreSQL
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL Database Connection (for Railway)
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
db.on('connect', () => {
  console.log('🔗 Database connection established');
});

db.on('error', (err) => {
  console.error('❌ Database connection error:', err.message);
});

// Function to run KYC database migrations
const runKYCDatabaseMigrations = async () => {
  console.log('🔄 Running KYC database migrations...');
  
  try {
    // Check if users table exists first
    const usersTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    if (!usersTableCheck.rows[0].exists) {
      console.log('⚠️ Users table does not exist. Skipping KYC migrations.');
      return;
    }

    // Migration SQL for KYC functionality
    const migrationSQL = `
      -- Create kyc_submissions table
      CREATE TABLE IF NOT EXISTS kyc_submissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reference_id VARCHAR(50) UNIQUE NOT NULL,
        fullname VARCHAR(100) NOT NULL,
        dob DATE NOT NULL,
        address TEXT NOT NULL,
        id_type VARCHAR(20) NOT NULL,
        id_number VARCHAR(50) NOT NULL,
        bvn VARCHAR(11) NOT NULL,
        country VARCHAR(2) NOT NULL,
        occupation VARCHAR(100) NOT NULL,
        source_funds VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        reviewer_id INTEGER REFERENCES users(id),
        rejection_reason TEXT,
        email VARCHAR(255),
        is_bvn_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Create indexes for faster queries (only if they don't exist)
      CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_submissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_submissions(status);
      CREATE INDEX IF NOT EXISTS idx_kyc_submitted_at ON kyc_submissions(submitted_at);
      
      -- Add KYC columns to users table if they don't exist
      DO $$ 
      BEGIN 
        -- Check and add kyc_status column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='kyc_status') THEN
          ALTER TABLE users ADD COLUMN kyc_status VARCHAR(20) DEFAULT 'not_submitted';
          RAISE NOTICE 'Added kyc_status column to users table';
        END IF;
        
        -- Check and add kyc_submitted_at column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='kyc_submitted_at') THEN
          ALTER TABLE users ADD COLUMN kyc_submitted_at TIMESTAMP;
          RAISE NOTICE 'Added kyc_submitted_at column to users table';
        END IF;
        
        -- Check and add kyc_verified_at column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='kyc_verified_at') THEN
          ALTER TABLE users ADD COLUMN kyc_verified_at TIMESTAMP;
          RAISE NOTICE 'Added kyc_verified_at column to users table';
        END IF;
        
        -- Check and add kyc_rejection_reason column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='kyc_rejection_reason') THEN
          ALTER TABLE users ADD COLUMN kyc_rejection_reason TEXT;
          RAISE NOTICE 'Added kyc_rejection_reason column to users table';
        END IF;
        
        -- Check and add tier_level column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='tier_level') THEN
          ALTER TABLE users ADD COLUMN tier_level VARCHAR(20) DEFAULT 'basic';
          RAISE NOTICE 'Added tier_level column to users table';
        END IF;
        
        -- Check and add full_name column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='full_name') THEN
          ALTER TABLE users ADD COLUMN full_name VARCHAR(100);
          RAISE NOTICE 'Added full_name column to users table';
        END IF;
        
        -- Check and add date_of_birth column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='date_of_birth') THEN
          ALTER TABLE users ADD COLUMN date_of_birth DATE;
          RAISE NOTICE 'Added date_of_birth column to users table';
        END IF;
        
        -- Check and add bvn column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='bvn') THEN
          ALTER TABLE users ADD COLUMN bvn VARCHAR(11);
          RAISE NOTICE 'Added bvn column to users table';
        END IF;
        
        -- Check and add kyc_verified column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='kyc_verified') THEN
          ALTER TABLE users ADD COLUMN kyc_verified BOOLEAN DEFAULT false;
          RAISE NOTICE 'Added kyc_verified column to users table';
        END IF;
        
      END $$;
    `;
    
    // Execute migration
    await db.query(migrationSQL);
    console.log('✅ KYC database migrations completed successfully');
    
    // Verify the migration
    const verifyQuery = `
      SELECT 
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'kyc_submissions')) as kyc_table_exists,
        (SELECT COUNT(*) FROM kyc_submissions) as kyc_submission_count;
    `;
    
    const verifyResult = await db.query(verifyQuery);
    console.log(`📊 KYC Table Status: ${verifyResult.rows[0].kyc_table_exists ? 'Exists' : 'Missing'}`);
    console.log(`📊 KYC Submissions: ${verifyResult.rows[0].kyc_submission_count} records`);
    
  } catch (error) {
    // Check if error is because table already exists (common and safe to ignore)
    if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
      console.log('ℹ️ Database tables already exist (continuing)');
    } else {
      console.error('❌ Database migration error:', error.message);
      console.log('⚠️ Migration failed, but server will continue running...');
    }
  }
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Health check endpoint (with DB check)
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await db.query('SELECT 1');
    
    res.status(200).json({
      status: 'success',
      message: 'FlipCash API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: 'connected',
      version: process.env.API_VERSION || 'v1',
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'API is running but database connection failed',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Database status endpoint
app.get('/api/status/db', async (req, res) => {
  try {
    const result = await db.query('SELECT version(), current_timestamp');
    res.json({
      status: 'connected',
      postgresVersion: result.rows[0].version,
      serverTime: result.rows[0].current_timestamp,
      poolStats: db.totalCount ? {
        totalConnections: db.totalCount,
        idleConnections: db.idleCount,
        waitingClients: db.waitingCount
      } : 'Not available'
    });
  } catch (error) {
    res.status(500).json({ status: 'disconnected', error: error.message });
  }
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
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting FlipCash API server...');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
    
    // Run KYC database migrations first
    await runKYCDatabaseMigrations();
    
    // Try Redis connection (optional)
    try {
      if (process.env.REDIS_URL) {
        const redis = require('redis');
        const redisClient = redis.createClient({ 
          url: process.env.REDIS_URL,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                console.log('❌ Too many Redis reconnection attempts. Giving up.');
                return new Error('Too many retries');
              }
              return Math.min(retries * 100, 3000);
            }
          }
        });
        
        redisClient.on('error', (err) => console.log('⚠️ Redis Error:', err.message));
        redisClient.on('connect', () => console.log('✅ Redis connected'));
        redisClient.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));
        
        await redisClient.connect().catch(() => {});
        console.log('✅ Redis connected successfully');
        
        // Set Redis client globally (optional)
        app.set('redis', redisClient);
      }
    } catch (e) {
      console.log('ℹ️ Redis not available or failed to connect (continuing)');
    }
    
    // Test database connection before starting server
    try {
      await db.query('SELECT NOW()');
      console.log('✅ Database connection test successful');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      console.log('⚠️ Server will start without database connection');
    }
    
    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 FlipCash API running on port ${PORT}`);
      console.log(`🌐 API Base URL: http://localhost:${PORT}/api/${API_VERSION}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/health`);
      console.log(`📊 Database Status: http://localhost:${PORT}/api/status/db`);
      console.log(`✅ Server ready!`);
      console.log('='.repeat(50));
      console.log('🔄 KYC Features:');
      console.log('  • POST /api/v1/users/kyc - Submit KYC');
      console.log('  • GET  /api/v1/users/kyc - Get KYC Status');
      console.log('='.repeat(50));
    });
    
    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      console.log('\n🛑 Received shutdown signal, closing server...');
      
      server.close(async () => {
        console.log('✅ HTTP server closed');
        
        // Close database connections
        try {
          await db.end();
          console.log('✅ Database connections closed');
        } catch (dbError) {
          console.error('❌ Error closing database:', dbError);
        }
        
        // Close Redis if exists
        if (app.get('redis')) {
          try {
            await app.get('redis').quit();
            console.log('✅ Redis connection closed');
          } catch (redisError) {
            console.error('❌ Error closing Redis:', redisError);
          }
        }
        
        console.log('👋 Server shutdown complete');
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcing shutdown');
        process.exit(1);
      }, 10000);
    };
    
    // Listen for termination signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    return server;
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Export for testing
module.exports = { app, startServer, db };

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}
