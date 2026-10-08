const express = require('express');
const { singleImageUpload } = require('../middleware/upload');
const optionalAuth = require('../middleware/optionalAuth');
const reservationAccess = require('../middleware/reservationAccess');
const { getReservation, submitPaymentProof } = require('../controllers/publicReservationController');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// GET /api/reservations/:id
router.get('/:id', optionalAuth, reservationAccess, getReservation);

// POST /api/reservations/:id/payment
router.post('/:id/payment', rateLimit({ max: 5 }), optionalAuth, reservationAccess, singleImageUpload('proof_of_payment'), submitPaymentProof);

module.exports = router;
