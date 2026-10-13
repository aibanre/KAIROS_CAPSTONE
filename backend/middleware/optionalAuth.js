const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtSecret');

const COOKIE_NAME = 'kairos_auth';

function optionalAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  try {
    req.user = jwt.verify(token, getJwtSecret());
    return next();
  } catch (err) {
    return next();
  }
}

module.exports = optionalAuth;
