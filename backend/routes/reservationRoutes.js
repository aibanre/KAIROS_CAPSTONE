const express = require('express');
const { createReservation } = require('../controllers/reservationController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/reservations
router.post('/', requireAuth, requireRole('customer'), createReservation);

module.exports = router;
