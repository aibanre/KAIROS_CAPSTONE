const express = require('express');
const { singleImageUpload } = require('../middleware/upload');
const { getReservation, submitPaymentProof } = require('../controllers/publicReservationController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// GET /api/reservations/:id
router.get('/:id', requireAuth, requireRole('customer', 'admin', 'receptionist'), getReservation);

// POST /api/reservations/:id/payment
router.post('/:id/payment', rateLimit({ max: 5 }), requireAuth, requireRole('customer', 'admin', 'receptionist'), singleImageUpload('proof_of_payment'), submitPaymentProof);

module.exports = router;
