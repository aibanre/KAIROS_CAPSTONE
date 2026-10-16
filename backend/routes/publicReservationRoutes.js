const express = require('express');
const { singleImageUpload } = require('../middleware/upload');
const { rateLimit } = require('../middleware/rateLimit');
const { getReservation, submitPaymentProof } = require('../controllers/publicReservationController');

const router = express.Router();

// GET /api/reservations/:id
router.get('/:id', getReservation);

// POST /api/reservations/:id/payment
router.post('/:id/payment',
  rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.clientIp || req.ip,
    ignorePath: true,
  }),
  singleImageUpload('proof_of_payment'),
  submitPaymentProof
);

module.exports = router;
