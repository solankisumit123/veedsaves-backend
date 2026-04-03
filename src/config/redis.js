const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Instead of letting Bull crash the app if Redis implies a connection refusal,
// We use a manual ping to check if Redis is alive before instantiating Queue
const checkRedisConnection = async () => {
    return new Promise((resolve) => {
        const tempClient = new IORedis(REDIS_URL, {
            maxRetriesPerRequest: 1,
            retryStrategy: () => null, // Don't retry
            connectTimeout: 2000
        });

        tempClient.on('error', (err) => {
            console.warn('⚠️ [Redis] Connection failed. Fallback queue will be activated.');
            tempClient.disconnect();
            resolve(false);
        });

        tempClient.on('ready', () => {
            console.log('✅ [Redis] Connection successful.');
            tempClient.quit();
            resolve(true);
        });
    });
};

module.exports = { REDIS_URL, checkRedisConnection };
