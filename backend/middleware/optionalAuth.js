const { getJwtSecret } = require('../utils/jwtSecret');
const { verifyJwt } = require('../utils/sessionJwt');

const COOKIE_NAME = 'kairos_auth';

function optionalAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  try {
    req.user = verifyJwt(token, getJwtSecret());
    return next();
  } catch (err) {
    return next();
  }
}

module.exports = optionalAuth;
