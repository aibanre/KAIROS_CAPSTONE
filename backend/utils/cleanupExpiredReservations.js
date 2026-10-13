const pool = require('../config/db');
const logAudit = require('./logAudit');
const { ACTIONS, ENTITY_TYPES } = require('./auditConstants');
const { recordReservationStatusHistory } = require('./reservationStatusHistory');

let cleanupRunning = false;

async function runCleanup() {
  if (cleanupRunning) return;
  cleanupRunning = true;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [expiredReservations] = await connection.query(
      `SELECT reservation_id, booking_reference, customer_id, room_id, venue_id, status
       FROM Reservations
       WHERE status = 'payment_pending'
         AND hold_expires_at IS NOT NULL
         AND hold_expires_at < NOW()`
    );

    for (const reservation of expiredReservations) {
      if (reservation.room_id) {
        await connection.query('SELECT room_id FROM Rooms WHERE room_id = ? FOR UPDATE', [reservation.room_id]);
      } else if (reservation.venue_id) {
        await connection.query('SELECT venue_id FROM Venues WHERE venue_id = ? FOR UPDATE', [reservation.venue_id]);
      }
      const [lockedReservations] = await connection.query(
        `SELECT reservation_id, booking_reference, customer_id, room_id, venue_id, status
         FROM Reservations
         WHERE reservation_id = ?
           AND status = 'payment_pending'
           AND hold_expires_at IS NOT NULL
           AND hold_expires_at < NOW()
         FOR UPDATE`,
        [reservation.reservation_id]
      );
      if (lockedReservations.length === 0) continue;
      const lockedReservation = lockedReservations[0];
      await connection.query(
        `UPDATE Reservations
         SET status = 'cancelled', cancellation_reason = 'Payment hold expired.'
         WHERE reservation_id = ? AND status = 'payment_pending'`,
        [reservation.reservation_id]
      );
      await recordReservationStatusHistory(
        connection,
        reservation.reservation_id,
        'payment_pending',
        'cancelled',
        'system',
        null,
        'Payment hold expired.'
      );
      await logAudit({
        connection,
        userId: null,
        action: ACTIONS.RESERVATION_HOLD_EXPIRED,
        entityType: ENTITY_TYPES.RESERVATION,
        entityId: reservation.reservation_id,
        oldValue: { status: lockedReservation.status },
        newValue: {
          booking_reference: lockedReservation.booking_reference,
          customer_id: lockedReservation.customer_id,
          room_id: lockedReservation.room_id,
          venue_id: lockedReservation.venue_id,
          status: 'cancelled',
          cancellation_reason: 'Payment hold expired.',
        },
      });
    }

    await connection.commit();
    if (expiredReservations.length > 0) {
      console.log(`[cleanupExpiredReservations] Cancelled ${expiredReservations.length} expired payment hold(s).`);
    }
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('[cleanupExpiredReservations] Rollback error:', rollbackError.message);
    }
    console.error('[cleanupExpiredReservations] Error:', err.message);
    if (err.code === 'ER_LOCK_DEADLOCK') throw err;
  } finally {
    connection.release();
    cleanupRunning = false;
  }

}

async function cleanupExpiredReservations() {
  try {
    await runCleanup();
  } catch (err) {
    if (err.code === 'ER_LOCK_DEADLOCK') {
      console.warn('[cleanupExpiredReservations] Deadlock detected; retrying once.');
      try {
        await runCleanup();
      } catch (retryError) {
        console.error('[cleanupExpiredReservations] Retry error:', retryError.message);
      }
      return;
    }
    console.error('[cleanupExpiredReservations] Error:', err.message);
  }
}

function startExpiredReservationCleanup() {
  cleanupExpiredReservations();
  return setInterval(cleanupExpiredReservations, 60 * 1000);
}

module.exports = { startExpiredReservationCleanup };
