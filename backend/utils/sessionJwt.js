const jwt = require('jsonwebtoken');

function signJwt(payload, secret, expiresIn) {
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn });
}

function verifyJwt(token, secret) {
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

module.exports = { signJwt, verifyJwt };
