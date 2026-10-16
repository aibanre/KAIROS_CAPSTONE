const buckets = new Map();
const MAX_BUCKETS = 10000;
let lastPrunedAt = 0;

function rateLimit({ windowMs = 60 * 1000, max = 30, keyGenerator, skip, message, onLimit, ignorePath = false } = {}) {
  return (req, res, next) => {
    if (skip?.(req)) return next();

    const identifier = keyGenerator ? keyGenerator(req) : (req.clientIp || req.ip);
    const routeKey = ignorePath ? req.baseUrl : `${req.baseUrl}${req.path}`;
    const key = `${windowMs}:${max}:${identifier}:${routeKey}`;
    const now = Date.now();
    if (now - lastPrunedAt >= 60 * 1000) {
      for (const [bucketKey, entry] of buckets) {
        if (now - entry.startedAt >= entry.windowMs) buckets.delete(bucketKey);
      }
      lastPrunedAt = now;
    }

    const bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      if (bucket) buckets.delete(key);
      if (buckets.size >= MAX_BUCKETS) {
        for (const [bucketKey, entry] of buckets) {
          if (now - entry.startedAt >= entry.windowMs) buckets.delete(bucketKey);
        }
      }
      if (buckets.size >= MAX_BUCKETS) {
        res.set('Retry-After', '60');
        if (onLimit) {
          Promise.resolve(onLimit(req)).catch((err) => {
            console.error('[rateLimit] Limit audit failed:', err.message);
          });
        }
        return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
      }
      buckets.set(key, { startedAt: now, count: 1, windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000))));
      if (onLimit) {
        Promise.resolve(onLimit(req)).catch((err) => {
          console.error('[rateLimit] Limit audit failed:', err.message);
        });
      }
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }
    return next();
  };
}

function resetRateLimits() {
  buckets.clear();
}

module.exports = { rateLimit, resetRateLimits };
