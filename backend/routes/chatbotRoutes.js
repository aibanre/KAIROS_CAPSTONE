const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { message, history, clearHistory } = require('../controllers/chatbotController');
const { rateLimit } = require('../middleware/rateLimit');
const router = express.Router();
router.post('/message', rateLimit({ max: 20 }), requireAuth, requireRole('customer'), message);
router.get('/history', requireAuth, requireRole('customer'), history);
router.delete('/history', requireAuth, requireRole('customer'), clearHistory);
module.exports = router;
