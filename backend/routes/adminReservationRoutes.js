const express = require('express');
const { singleImageUpload } = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
	getAllReservations,
	lookupReservation,
	previewAttendance,
	checkInReservation,
	checkOutReservation,
	collectBalance,
	addExtraBed,
} = require('../controllers/adminReservationController');

const router = express.Router();

router.use(requireAuth);

router.get('/lookup', requireRole('admin', 'receptionist'), lookupReservation);
router.get('/', requireRole('admin', 'receptionist'), getAllReservations);
router.post('/:id/balance', requireRole('admin', 'receptionist'), singleImageUpload('proof_of_payment'), collectBalance);
router.post('/:id/addons/extra-bed', requireRole('admin', 'receptionist'), addExtraBed);
router.get('/:id/attendance-preview', requireRole('admin', 'receptionist'), previewAttendance);
router.patch('/:id/check-in', requireRole('admin', 'receptionist'), checkInReservation);
router.patch('/:id/check-out', requireRole('admin', 'receptionist'), checkOutReservation);
module.exports = router;