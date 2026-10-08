const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getDashboard } = require('../controllers/adminDashboardController');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'receptionist'));
router.get('/', getDashboard);

module.exports = router;