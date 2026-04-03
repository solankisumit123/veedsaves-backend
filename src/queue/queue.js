let Queue;
try {
  Queue = require('bull');
} catch (e) { }

const { REDIS_URL, checkRedisConnection } = require('../config/redis');
const { processJob } = require('./worker');

let downloadJobQueue = {
  // Safe Fallback queue initially
  add: async (data) => {
    setImmediate(() => {
      const { jobId, url, format_id, ext } = data;
      processJob(jobId, url, format_id, ext).catch(()=> {});
    });
    return { id: data.jobId };
  }
};

// Initialize if Bull is installed and Redis is explicitly active
const initQueue = async () => {
  if (Queue) {
    const isRedisAlive = await checkRedisConnection();
    if (isRedisAlive) {
      console.log('⚡ [Queue] Initialing Bull Redis Queue Router');
      const bullQueue = new Queue('video_downloads', REDIS_URL);
      
      bullQueue.process(async (job) => {
        const { jobId, url, format_id, ext } = job.data;
        return processJob(jobId, url, format_id, ext);
      });
      
      // Override fallback with real queue
      downloadJobQueue = bullQueue;
    } else {
      console.log('⚡ [Queue] Initialing Native Async Queue (Fallback)');
    }
  }
};

initQueue();

module.exports = { 
    getQueue: () => downloadJobQueue 
};
