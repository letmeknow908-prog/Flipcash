const redis = require('redis');

// Create Redis client with Railway variables
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Redis reconnection failed after 10 attempts');
        return new Error('Redis reconnection failed');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('ready', () => {
  console.log('✅ Redis ready to accept commands');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    // Don't throw - allow app to start without Redis
  }
};

// Initialize connection
connectRedis();

module.exports = { redisClient, connectRedis };
