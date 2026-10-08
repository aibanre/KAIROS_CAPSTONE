const { verifyReservationToken } = require('../utils/reservationToken');
const pool = require('../config/db');

async function reservationAccess(req, res, next) {
  const reservationId = Number(req.params.id);
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Invalid reservation ID.' });
  }

  const connection = await pool.getConnection();
  try {
    // Load the reservation's customer_id once (used for existence and ownership checks).
    const [rows] = await connection.query(
      'SELECT customer_id FROM Reservations WHERE reservation_id = ? LIMIT 1',
      [reservationId]
    );
    const reservation = rows[0];

    let accessMode;
    if (req.user) {
      if (req.user.role === 'admin' || req.user.role === 'receptionist') {
        accessMode = 'staff';
      } else if (req.user.role === 'customer') {
        if (!reservation) {
          // Valid customer session: access granted, but the reservation does not exist.
          return res.status(404).json({ error: 'Reservation not found.' });
        }
        if (reservation.customer_id !== req.user.user_id) {
          return res.status(403).json({ error: 'You do not have permission to perform this action.' });
        }
        accessMode = 'customer';
      } else {
        return res.status(403).json({ error: 'You do not have permission to perform this action.' });
      }
    } else {
      // Session-less: token-only access.
      const token = req.headers['x-reservation-token'];
      if (!token) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      const payload = verifyReservationToken(token);
      if (!payload || payload.purpose !== 'reservation_access' || Number(payload.reservation_id) !== reservationId) {
        return res.status(403).json({ error: 'Invalid or expired reservation access token.' });
      }
      accessMode = 'token';
    }

    if (!reservation) {
      // Access granted, but the reservation does not exist (no ID probing).
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    req.accessMode = accessMode;
    return next();
  } catch (err) {
    console.error('[reservationAccess] Error:', err.message);
    return res.status(500).json({ error: 'Failed to verify reservation access.' });
  } finally {
    connection.release();
  }
}

module.exports = reservationAccess;
