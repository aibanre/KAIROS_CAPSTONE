const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const proxyaddr = require('proxy-addr');
const { getClientIp } = require('../config/security');
const { rateLimit, resetRateLimits } = require('../middleware/rateLimit');
const { createOriginSecurityMiddleware, isAllowedOrigin } = require('../middleware/originSecurity');
const { signJwt, verifyJwt } = require('../utils/sessionJwt');
const { getStartupSecurityProblems } = require('../utils/startupSecurity');
const { isValidStaffPassword } = require('../utils/staffPassword');

function makeRequest(headers = {}) {
  const req = {
    baseUrl: '/api/auth',
    path: '/login',
    headers,
    socket: { remoteAddress: '::ffff:127.0.0.1' },
    get(name) {
      return this.headers[name.toLowerCase()];
    },
  };
  req.clientIp = getClientIp(req);
  return req;
}

function makeResponse() {
  return {
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('one trusted Render proxy hop ignores a forged leftmost X-Forwarded-For value', () => {
  resetRateLimits();
  const limiter = rateLimit({ max: 1 });
  const trustedProxy = (_address, index) => index < 1;
  const makeProxiedRequest = (forwardedFor) => {
    const req = {
      baseUrl: '/api/auth',
      path: '/login',
      headers: { 'x-forwarded-for': forwardedFor },
      socket: { remoteAddress: '10.0.0.5' },
      connection: { remoteAddress: '10.0.0.5' },
      get(name) { return this.headers[name.toLowerCase()]; },
    };
    req.ip = proxyaddr(req, trustedProxy);
    req.clientIp = getClientIp(req);
    return req;
  };
  const first = makeProxiedRequest('198.51.100.99, 203.0.113.10');
  const second = makeProxiedRequest('203.0.113.44, 203.0.113.10');
  let firstPassed = false;
  limiter(first, makeResponse(), () => { firstPassed = true; });
  const blockedResponse = makeResponse();
  limiter(second, blockedResponse, () => assert.fail('forged XFF must not bypass the limiter'));
  assert.equal(firstPassed, true);
  assert.equal(first.clientIp, '203.0.113.10');
  assert.equal(first.clientIp, second.clientIp);
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(blockedResponse.headers['Retry-After'] !== undefined, true);
});

test('independent IP windows keep separate buckets', () => {
  resetRateLimits();
  const minuteLimit = rateLimit({ windowMs: 60 * 1000, max: 1 });
  const hourLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 2 });
  const firstMinuteResponse = makeResponse();
  const firstHourResponse = makeResponse();
  minuteLimit(makeRequest(), firstMinuteResponse, () => {});
  hourLimit(makeRequest(), firstHourResponse, () => {});
  const secondMinuteResponse = makeResponse();
  const secondHourResponse = makeResponse();
  minuteLimit(makeRequest(), secondMinuteResponse, () => {});
  hourLimit(makeRequest(), secondHourResponse, () => {});
  assert.equal(secondMinuteResponse.statusCode, 429);
  assert.equal(secondHourResponse.statusCode, undefined);
});

test('visitor-wide limits share buckets across reservation paths', () => {
  resetRateLimits();
  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 1,
    keyGenerator: (req) => req.clientIp,
    ignorePath: true,
  });
  const first = makeRequest();
  first.baseUrl = '/api/reservations';
  first.path = '/';
  first.clientIp = '198.51.100.20';
  const second = { ...first, path: '/hold' };
  limiter(first, makeResponse(), () => {});
  const blockedResponse = makeResponse();
  limiter(second, blockedResponse, () => assert.fail('route path must not split visitor-wide limit'));
  assert.equal(blockedResponse.statusCode, 429);
});

test('untrusted X-Forwarded-For is ignored for direct non-proxy requests', () => {
  const req = makeRequest({ 'x-forwarded-for': '203.0.113.99' });
  req.socket.remoteAddress = '192.0.2.10';
  req.ip = '192.0.2.10';
  assert.equal(getClientIp(req), '192.0.2.10');
});

test('credentialed CORS and unsafe-method origin checks allow only exact frontend origins', () => {
  const allowedOrigins = ['https://bookkaiazul.live', 'https://www.bookkaiazul.live'];
  assert.equal(isAllowedOrigin('https://bookkaiazul.live', allowedOrigins), true);
  assert.equal(isAllowedOrigin('https://preview.vercel.app', allowedOrigins), false);
  assert.equal(isAllowedOrigin('https://bookkaiazul.live.attacker.test', allowedOrigins), false);

  const middleware = createOriginSecurityMiddleware(allowedOrigins);
  const headers = {};
  const response = {
    header(name, value) { headers[name] = value; return this; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
    sendStatus(statusCode) { this.statusCode = statusCode; return this; },
  };
  let passed = false;
  middleware({
    method: 'POST',
    get(name) {
      return { origin: 'https://bookkaiazul.live', referer: undefined }[name.toLowerCase()];
    },
  }, response, () => { passed = true; });
  assert.equal(passed, true);
  assert.equal(headers['Access-Control-Allow-Origin'], 'https://bookkaiazul.live');
  assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
  assert.match(headers['Access-Control-Allow-Headers'], /X-Reservation-Token/);

  const blockedResponse = { ...response, status: response.status, json: response.json };
  middleware({
    method: 'POST',
    get(name) {
      return { origin: 'https://preview.vercel.app', referer: undefined }[name.toLowerCase()];
    },
  }, blockedResponse, () => assert.fail('preview deployment origin must be rejected'));
  assert.equal(blockedResponse.statusCode, 403);

  const refererResponse = { ...response, status: response.status, json: response.json };
  middleware({
    method: 'DELETE',
    get(name) {
      return { origin: undefined, referer: 'https://evil.test/path' }[name.toLowerCase()];
    },
  }, refererResponse, () => assert.fail('untrusted Referer must be rejected'));
  assert.equal(refererResponse.statusCode, 403);
});

test('session JWTs are HS256 and alg:none tokens are rejected', () => {
  const secret = 'a sufficiently long test secret';
  const token = signJwt({ user_id: 42, role: 'admin' }, secret, '1h');
  assert.equal(jwt.decode(token, { complete: true }).header.alg, 'HS256');
  assert.equal(verifyJwt(token, secret).role, 'admin');

  const unsignedToken = jwt.sign({ user_id: 42, role: 'admin' }, '', { algorithm: 'none' });
  assert.throws(() => verifyJwt(unsignedToken, secret));
});

test('startup readiness accepts safe production settings and flags weak settings', () => {
  const safeSettings = {
    NODE_ENV: 'production',
    JWT_SECRET: 's'.repeat(48),
    COOKIE_SECURE: 'true',
    ALLOWED_ORIGINS: 'https://bookkaiazul.live,https://www.bookkaiazul.live',
    FRONTEND_URL: 'https://bookkaiazul.live',
    ADMIN_APP_URL: 'https://bookkaiazul.live',
    PUBLIC_APP_URL: 'https://bookkaiazul.live',
    ADMIN_EMAIL: 'security@example.com',
    ADMIN_PASSWORD: 'not-a-default-password',
    STAFF_SESSION_HOURS: '8',
    TRUST_PROXY_HOPS: '1',
    DB_SSL: 'true',
    DB_SSL_CA: 'test CA',
    STAFF_LOGIN_IP_PER_MINUTE: '5',
    STAFF_LOGIN_IP_PER_HOUR: '30',
  };
  assert.deepEqual(getStartupSecurityProblems(safeSettings), []);

  const unsafeSettings = {
    ...safeSettings,
    JWT_SECRET: '12345678',
    COOKIE_SECURE: 'false',
    ALLOWED_ORIGINS: 'https://bookkaiazul.live,https://*.vercel.app',
    ADMIN_PASSWORD: 'admin123',
  };
  assert.deepEqual(
    getStartupSecurityProblems(unsafeSettings).sort(),
    ['ADMIN_EMAIL/ADMIN_PASSWORD', 'ALLOWED_ORIGINS', 'COOKIE_SECURE', 'JWT_SECRET'].sort()
  );
  assert.ok(getStartupSecurityProblems({
    ...safeSettings,
    ALLOWED_ORIGINS: 'https://bookkaiazul.live,http://evil.test',
  }).includes('ALLOWED_ORIGINS'));
});

test('staff password policy enforces length and rejects identity/common passwords', () => {
  assert.equal(isValidStaffPassword('Good-Staff-Pass-91', 'admin@example.com', 'Jane Admin'), true);
  assert.equal(isValidStaffPassword('short', 'admin@example.com', 'Jane Admin'), false);
  assert.equal(isValidStaffPassword('admin@example.com', 'admin@example.com', 'Jane Admin'), false);
  assert.equal(isValidStaffPassword('password123', 'admin@example.com', 'Jane Admin'), false);
});
