const COOKIE_SAMESITE_VALUES = new Set(['lax', 'strict', 'none']);

function getBooleanEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

const cookieSecure = getBooleanEnv('COOKIE_SECURE', process.env.NODE_ENV === 'production');
const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();

if (!COOKIE_SAMESITE_VALUES.has(cookieSameSite)) {
  throw new Error('COOKIE_SAMESITE must be lax, strict, or none.');
}
if (cookieSameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SAMESITE=none requires COOKIE_SECURE=true.');
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
  throw new Error('ALLOWED_ORIGINS must be configured in production.');
}

const cookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  maxAge: 1000 * 60 * 60 * 8,
};

module.exports = {
  allowedOrigins,
  cookieOptions,
  trustProxy: getBooleanEnv('TRUST_PROXY', false),
};
