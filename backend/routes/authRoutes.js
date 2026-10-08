const express = require('express');
const {
  registerCustomer,
  login,
  logout,
  getCurrentUser,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/register', rateLimit({ max: 10 }), registerCustomer);
router.post('/login', rateLimit({ max: 10 }), login);
router.post('/logout', logout);
router.get('/me', requireAuth, getCurrentUser);

module.exports = router;