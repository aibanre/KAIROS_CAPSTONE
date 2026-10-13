const buckets = new Map();

function rateLimit({ windowMs = 60 * 1000, max = 30, keyGenerator } = {}) {
  return (req, res, next) => {
    const identifier = keyGenerator ? keyGenerator(req) : req.ip;
    const key = `${identifier}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return next();
  };
}

function resetRateLimits() {
  buckets.clear();
}

module.exports = { rateLimit, resetRateLimits };
