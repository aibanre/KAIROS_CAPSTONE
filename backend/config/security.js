const COOKIE_SAMESITE_VALUES = new Set(['lax']);

function getBooleanEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

const cookieSecure = getBooleanEnv('COOKIE_SECURE', false);
const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();

if (!COOKIE_SAMESITE_VALUES.has(cookieSameSite)) {
  throw new Error('COOKIE_SAMESITE must be lax.');
}
const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([
  process.env.FRONTEND_URL,
  ...configuredOrigins,
].filter(Boolean))];

const trustProxyHops = process.env.TRUST_PROXY_HOPS === undefined
  ? 0
  : Number(process.env.TRUST_PROXY_HOPS);

if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}

const cookieOptions = {
  httpOnly: true,
  path: '/',
  secure: cookieSecure,
  sameSite: cookieSameSite,
  maxAge: 1000 * 60 * 60 * 24,
};

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

module.exports = {
  allowedOrigins,
  cookieOptions,
  cookieSecure,
  cookieSameSite,
  trustProxyHops,
  getClientIp,
};
