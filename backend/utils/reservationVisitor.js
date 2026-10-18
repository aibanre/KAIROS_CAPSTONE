const crypto = require('crypto');
const { cookieOptions } = require('../config/security');
const { getJwtSecret } = require('./jwtSecret');
const { signJwt, verifyJwt } = require('./sessionJwt');

const RESERVATION_VISITOR_COOKIE = 'kairos_reservation_visitor';
const VISITOR_TOKEN_TTL = '365d';
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;
const VISITOR_TOKEN_SECRET = `${getJwtSecret()}:reservation_visitor`;

function verifyVisitorToken(token) {
  if (!token) return null;
  try {
    const payload = verifyJwt(token, VISITOR_TOKEN_SECRET);
    if (payload.purpose !== 'reservation_visitor' || typeof payload.visitor_id !== 'string') return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function visitorKeyFromToken(token) {
  const payload = verifyVisitorToken(token);
  if (!payload) return null;
  return crypto.createHash('sha256').update(payload.visitor_id).digest('hex');
}

function createVisitorToken() {
  const visitorId = crypto.randomBytes(32).toString('hex');
  return signJwt(
    { visitor_id: visitorId, purpose: 'reservation_visitor' },
    VISITOR_TOKEN_SECRET,
    VISITOR_TOKEN_TTL,
  );
}

function ensureReservationVisitor(req, res, next) {
  let token = req.cookies?.[RESERVATION_VISITOR_COOKIE];
  let visitorKey = visitorKeyFromToken(token);
  if (!visitorKey) {
    token = createVisitorToken();
    visitorKey = visitorKeyFromToken(token);
    res.cookie(RESERVATION_VISITOR_COOKIE, token, {
      ...cookieOptions,
      maxAge: VISITOR_COOKIE_MAX_AGE,
    });
  }
  req.reservationVisitorKey = visitorKey;
  return next();
}

module.exports = {
  RESERVATION_VISITOR_COOKIE,
  ensureReservationVisitor,
  visitorKeyFromToken,
};
