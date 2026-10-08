const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getAuditLogs } = require('../controllers/adminAuditLogController');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', getAuditLogs);

module.exports = router;
