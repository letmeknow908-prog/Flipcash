// config/redis.js
const { createClient } = require('redis');

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });

  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  redisClient.on('connect', () => console.log('🔗 Redis connected'));
  
  (async () => {
    await redisClient.connect().catch(() => {});
  })();
} else {
  console.log('ℹ️ Redis not configured (continuing without cache)');
}

module.exports = redisClient;
