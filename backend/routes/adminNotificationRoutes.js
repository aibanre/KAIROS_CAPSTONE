const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { subscribe } = require('../services/notificationHub');

const router = express.Router();

router.get('/stream', requireAuth, requireRole('admin', 'receptionist'), (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const sendHeartbeat = () => res.write(': ping\n\n');
  const heartbeat = setInterval(sendHeartbeat, 25000);
  const unsubscribe = subscribe((event) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
