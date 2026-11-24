/**
 * In-memory sliding window rate limiter
 */
const requestBuckets = new Map();

function rateLimit({ windowMs = 60000, max = 100, message = 'Too many requests. Please try again later.' } = {}) {
  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'global';
    const now = Date.now();

    let bucket = requestBuckets.get(key);
    if (!bucket) {
      bucket = [];
      requestBuckets.set(key, bucket);
    }

    // Filter out requests outside the sliding window
    bucket = bucket.filter(timestamp => now - timestamp < windowMs);
    requestBuckets.set(key, bucket);

    if (bucket.length >= max) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfterSeconds: Math.ceil((bucket[0] + windowMs - now) / 1000)
        }
      });
    }

    bucket.push(now);
    next();
  };
}

module.exports = { rateLimit };
