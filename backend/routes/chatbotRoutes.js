const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { message } = require('../controllers/chatbotController');
const { rateLimit } = require('../middleware/rateLimit');
const router = express.Router();
router.post('/message', rateLimit({ max: 20 }), requireAuth, requireRole('customer'), message);
module.exports = router;
