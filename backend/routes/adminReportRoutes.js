const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getReports } = require('../controllers/adminReportController');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'receptionist'));
router.get('/', getReports);

module.exports = router;