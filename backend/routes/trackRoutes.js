const express = require('express');
const pool = require('../config/db');
const { rateLimit } = require('../middleware/rateLimit');
const router = express.Router();
router.post('/', rateLimit({ max: 10, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  const reference = typeof req.body.booking_reference === 'string' ? req.body.booking_reference.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!reference || !email) return res.status(400).json({ error: 'booking_reference and email are required.' });
  try {
    const [rows] = await pool.query(
      `SELECT r.reservation_id, r.booking_reference, r.status, r.check_in_date, r.check_out_date, r.event_date, r.total_amount
       FROM Reservations r INNER JOIN Customer c ON c.customer_id=r.customer_id WHERE r.booking_reference=? AND c.email=? LIMIT 1`, [reference, email]
    );
    if (!rows.length) return res.status(404).json({ error: 'Reservation not found.' });
    return res.json({ reservation: rows[0] });
  } catch (err) { return res.status(500).json({ error: 'Failed to track reservation.' }); }
});
module.exports = router;
