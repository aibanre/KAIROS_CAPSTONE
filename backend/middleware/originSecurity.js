const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_REQUEST_HEADERS = 'Origin, X-Requested-With, Content-Type, Accept, X-Reservation-Token';

function isAllowedOrigin(origin, allowedOrigins) {
  return typeof origin === 'string'
    && !origin.includes('*')
    && allowedOrigins.includes(origin);
}

function getRequestOrigins(req) {
  const origins = [];
  if (req.get('origin') !== undefined) origins.push(req.get('origin'));
  const referer = req.get('referer');
  if (referer !== undefined) {
    try {
      origins.push(new URL(referer).origin);
    } catch {
      origins.push('');
    }
  }
  return origins;
}

function createOriginSecurityMiddleware(allowedOrigins) {
  return (req, res, next) => {
    if (UNSAFE_METHODS.has(req.method)
      && getRequestOrigins(req).some((origin) => !isAllowedOrigin(origin, allowedOrigins))) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }

    const origin = req.get('origin');
    if (origin && isAllowedOrigin(origin, allowedOrigins)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Headers', ALLOWED_REQUEST_HEADERS);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  };
}

module.exports = { createOriginSecurityMiddleware, getRequestOrigins, isAllowedOrigin };
