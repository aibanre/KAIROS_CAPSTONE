const express = require('express');
const { singleImageUpload } = require('../middleware/upload');
const { getReservation, submitPaymentProof } = require('../controllers/publicReservationController');

const router = express.Router();

// GET /api/reservations/:id
router.get('/:id', getReservation);

// POST /api/reservations/:id/payment
router.post('/:id/payment', singleImageUpload('proof_of_payment'), submitPaymentProof);

module.exports = router;
