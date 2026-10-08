const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getAllPayments, acceptPayment, declinePayment } = require('../controllers/adminPaymentController');

const router = express.Router();

router.use(requireAuth);

router.get('/', requireRole('admin', 'receptionist'), getAllPayments);
router.patch('/:id/accept', requireRole('admin', 'receptionist'), acceptPayment);
router.patch('/:id/decline', requireRole('admin', 'receptionist'), declinePayment);

module.exports = router;
