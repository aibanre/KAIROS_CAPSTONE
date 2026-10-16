const DEFAULT_JWT_SECRETS = new Set([
  '12345678',
  'secret',
  'changeme',
  'change-me',
  'your-secret-key',
  'your_jwt_secret',
  'jwt-secret',
]);
const DEFAULT_ADMIN_EMAILS = new Set([
  'admin@example.com',
  'admin@kaiazul.com',
  'testadmin@example.com',
]);
const DEFAULT_ADMIN_PASSWORDS = new Set([
  '12345678',
  'password',
  'admin123',
  'change-me',
  'password123',
]);
const PRODUCTION_FRONTEND_ORIGINS = new Set([
  'https://bookkaiazul.live',
  'https://www.bookkaiazul.live',
]);
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'outlook.com',
  'hotmail.com', 'live.com', 'icloud.com', 'aol.com', 'proton.me',
  'protonmail.com', 'mail.com',
]);

function getStartupSecurityProblems(env = process.env) {
  const problems = [];
  const jwtSecret = String(env.JWT_SECRET || '');
  if (jwtSecret.length < 32 || DEFAULT_JWT_SECRETS.has(jwtSecret.trim().toLowerCase())) {
    problems.push('JWT_SECRET');
  }
  if (String(env.COOKIE_SECURE || '').toLowerCase() !== 'true') {
    problems.push('COOKIE_SECURE');
  }

  const origins = [
    ...String(env.ALLOWED_ORIGINS || '').split(','),
    String(env.FRONTEND_URL || ''),
  ].map((origin) => origin.trim()).filter(Boolean);
  if ((env.NODE_ENV === 'production' && !String(env.ALLOWED_ORIGINS || '').trim())
    || origins.length === 0 || origins.some((origin) => {
    if (origin.includes('*')) return true;
    try {
      const parsed = new URL(origin);
      return !['http:', 'https:'].includes(parsed.protocol)
        || parsed.origin !== origin
        || (env.NODE_ENV === 'production' && parsed.protocol !== 'https:');
    } catch {
      return true;
    }
  })) {
    problems.push('ALLOWED_ORIGINS');
  }
  if (env.NODE_ENV === 'production') {
    const exactOrigins = [...new Set(String(env.ALLOWED_ORIGINS || '')
      .split(',').map((origin) => origin.trim()).filter(Boolean))];
    if (String(env.FRONTEND_URL || '').trim() !== 'https://bookkaiazul.live'
      || exactOrigins.length !== PRODUCTION_FRONTEND_ORIGINS.size
      || exactOrigins.some((origin) => !PRODUCTION_FRONTEND_ORIGINS.has(origin))) {
      problems.push('ALLOWED_ORIGINS');
    }
    if (String(env.ADMIN_APP_URL || '').trim() !== 'https://bookkaiazul.live'
      || String(env.PUBLIC_APP_URL || '').trim() !== 'https://bookkaiazul.live') {
      problems.push('APP_URLS');
    }
  }

  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(env.ADMIN_PASSWORD || '').trim().toLowerCase();
  if (DEFAULT_ADMIN_EMAILS.has(adminEmail) || DEFAULT_ADMIN_PASSWORDS.has(adminPassword)) {
    problems.push('ADMIN_EMAIL/ADMIN_PASSWORD');
  }
  const sessionHours = Number(env.STAFF_SESSION_HOURS || 8);
  if (!Number.isInteger(sessionHours) || sessionHours < 1) {
    problems.push('STAFF_SESSION_HOURS');
  }
  const proxyHops = env.TRUST_PROXY_HOPS === undefined ? 0 : Number(env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || (env.NODE_ENV === 'production' && proxyHops !== 1)) {
    problems.push('TRUST_PROXY_HOPS');
  }
  if (env.NODE_ENV === 'production'
    && (String(env.DB_SSL || '').toLowerCase() !== 'true' || !String(env.DB_SSL_CA || '').trim())) {
    problems.push('DB_SSL');
  }
  for (const name of ['STAFF_LOGIN_IP_PER_MINUTE', 'STAFF_LOGIN_IP_PER_HOUR']) {
    const value = env[name];
    if (value !== undefined && (!/^\d+$/.test(String(value)) || Number(value) < 1)) problems.push(name);
  }

  return [...new Set(problems)];
}

function warnIfFreeMailSender(env = process.env) {
  const address = String(env.MAIL_FROM_EMAIL || '').trim();
  const domain = address.includes('@') ? address.split('@').pop().toLowerCase() : '';
  if (domain && FREE_MAIL_DOMAINS.has(domain)) {
    console.warn('[email] MAIL_FROM_EMAIL uses a free-mail domain; use an address on the verified sender domain for reliable delivery.');
  }
}

function assertStartupSecurity() {
  const problems = getStartupSecurityProblems();
  if (problems.length === 0) return;
  const message = `Unsafe security configuration: ${problems.join(', ')}`;
  if (process.env.NODE_ENV === 'production') throw new Error(message);
  console.warn(`[security] ${message}`);
}

async function checkDefaultAdminAccounts(pool) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM Users
     WHERE LOWER(username) IN ('admin', 'testadmin')
        OR LOWER(email) IN ('admin@example.com', 'admin@kaiazul.com', 'testadmin@example.com')`
  );
  if (Number(rows[0]?.count || 0) === 0) return;
  const message = 'Default admin identity found in Users.';
  if (process.env.NODE_ENV === 'production') throw new Error(message);
  console.warn(`[security] ${message}`);
}

module.exports = {
  getStartupSecurityProblems,
  assertStartupSecurity,
  checkDefaultAdminAccounts,
  warnIfFreeMailSender,
};
