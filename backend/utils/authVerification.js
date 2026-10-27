const crypto = require('crypto');

function verificationCodeHash(code) {
  const secret = process.env.AUTH_VERIFICATION_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('AUTH_VERIFICATION_SECRET or JWT_SECRET must be configured.');
  return crypto.createHmac('sha256', `${secret}:auth-verification-code`).update(String(code)).digest('hex');
}

module.exports = { verificationCodeHash };
