const express = require('express');
const {
  registerCustomer,
  login,
  logout,
  getCurrentUser,
  changePassword,
  forgotPassword,
  resetPassword,
  googleSignIn,
  completeGoogleSignIn,
  verifyRegistration,
  resendRegistrationCode,
  verifyLogin,
  resendLoginCode,
  recordStaffLoginThrottle,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const positiveInteger = (name, fallback) => {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex');
  next();
});

router.post('/register', rateLimit({ max: 10 }), rateLimit({
  max: 10,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`,
}), registerCustomer);
router.post('/login',
  rateLimit({ max: 10, skip: (req) => req.body?.portal === 'staff' }),
  rateLimit({
    max: 10,
    keyGenerator: (req) => `${req.clientIp || req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`,
    skip: (req) => req.body?.portal === 'staff',
  }),
  rateLimit({
    windowMs: 60 * 1000,
    max: positiveInteger('STAFF_LOGIN_IP_PER_MINUTE', 5),
    message: 'Too many attempts. Please try again later.',
    onLimit: recordStaffLoginThrottle,
    skip: (req) => req.body?.portal !== 'staff',
  }),
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: positiveInteger('STAFF_LOGIN_IP_PER_HOUR', 30),
    message: 'Too many attempts. Please try again later.',
    onLimit: recordStaffLoginThrottle,
    skip: (req) => req.body?.portal !== 'staff',
  }),
  login
);
router.post('/register/verify', rateLimit({ max: 20 }), rateLimit({
  max: 10,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`,
}), verifyRegistration);
router.post('/register/resend-code', rateLimit({ max: 10 }), rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`,
}), resendRegistrationCode);
router.post('/login/verify', rateLimit({ max: 20 }), rateLimit({
  max: 10,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.challenge || '').slice(0, 64)}`,
}), verifyLogin);
router.post('/login/resend-code', rateLimit({ max: 10 }), rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.challenge || '').slice(0, 64)}`,
}), resendLoginCode);
router.post('/forgot-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`,
}), forgotPassword);
router.post('/reset-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.token || '').slice(0, 16)}`,
}), resetPassword);
router.post('/google', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), googleSignIn);
router.post('/google/complete', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), completeGoogleSignIn);
router.post('/logout', logout);
router.get('/me', requireAuth, getCurrentUser);
router.post('/change-password', requireAuth, changePassword);

module.exports = router;