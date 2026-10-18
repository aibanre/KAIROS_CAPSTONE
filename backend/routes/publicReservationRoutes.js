const express = require('express');
const { singleImageUpload } = require('../middleware/upload');
const { rateLimit } = require('../middleware/rateLimit');
const { getReservation, submitPaymentProof } = require('../controllers/publicReservationController');
const optionalAuth = require('../middleware/optionalAuth');
const reservationAccess = require('../middleware/reservationAccess');

const router = express.Router();

// GET /api/reservations/:id
router.get('/:id', optionalAuth, reservationAccess, getReservation);

// POST /api/reservations/:id/payment
router.post('/:id/payment',
  rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.clientIp || req.ip,
    ignorePath: true,
  }),
  singleImageUpload('proof_of_payment'),
  optionalAuth,
  reservationAccess,
  submitPaymentProof
);

module.exports = router;
