const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getReports } = require('../controllers/adminReportController');
const { exportIncomePdf } = require('../controllers/adminIncomeReportController');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'receptionist'));
router.get('/income/pdf', requireRole('admin'), rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }), exportIncomePdf);
router.get('/', getReports);

module.exports = router;