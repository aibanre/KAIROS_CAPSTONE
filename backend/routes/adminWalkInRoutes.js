const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { singleImageUpload } = require('../middleware/upload');
const { getAvailability, getWalkInPaymentMethods, createWalkInBooking } = require('../controllers/adminWalkInController');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'receptionist'));

router.get('/availability', getAvailability);
router.get('/payment-methods', getWalkInPaymentMethods);
router.post('/bookings', singleImageUpload('proof_of_payment'), createWalkInBooking);

module.exports = router;
