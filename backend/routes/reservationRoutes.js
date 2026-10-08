const express = require('express');
const { createReservation } = require('../controllers/reservationController');
const { rateLimit } = require('../middleware/rateLimit');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

// POST /api/reservations (optional sessions only; guest flow is handled in the controller)
router.post(
  '/',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }),
  optionalAuth,
  createReservation
);

module.exports = router;
