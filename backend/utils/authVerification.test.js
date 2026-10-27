const assert = require('node:assert/strict');
const test = require('node:test');
const { verificationCodeHash } = require('./authVerification');

test('verification codes use a stable dedicated secret independent of JWT rotation', (t) => {
  const previousJwtSecret = process.env.JWT_SECRET;
  const previousVerificationSecret = process.env.AUTH_VERIFICATION_SECRET;
  t.after(() => {
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
    if (previousVerificationSecret === undefined) delete process.env.AUTH_VERIFICATION_SECRET;
    else process.env.AUTH_VERIFICATION_SECRET = previousVerificationSecret;
  });

  process.env.AUTH_VERIFICATION_SECRET = 'stable-auth-verification-secret';
  process.env.JWT_SECRET = 'jwt-secret-before-rotation';
  const issuedCodeHash = verificationCodeHash('012345');

  process.env.JWT_SECRET = 'jwt-secret-after-rotation';

  assert.equal(verificationCodeHash('012345'), issuedCodeHash);
  assert.notEqual(verificationCodeHash('543210'), issuedCodeHash);
});

test('verification code hashing falls back to the JWT secret when no dedicated secret is set', (t) => {
  const previousJwtSecret = process.env.JWT_SECRET;
  const previousVerificationSecret = process.env.AUTH_VERIFICATION_SECRET;
  t.after(() => {
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
    if (previousVerificationSecret === undefined) delete process.env.AUTH_VERIFICATION_SECRET;
    else process.env.AUTH_VERIFICATION_SECRET = previousVerificationSecret;
  });

  delete process.env.AUTH_VERIFICATION_SECRET;
  process.env.JWT_SECRET = 'legacy-jwt-secret';
  const legacyHash = verificationCodeHash('012345');

  assert.equal(verificationCodeHash('012345'), legacyHash);
});
