const pool = require('../config/db');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const {
  formatManilaDateTime,
  parseLocalDateTime,
  STANDARD_CHECK_OUT_HOUR,
} = require('../config/reservationAttendance');
const { recordReservationStatusHistory } = require('../utils/reservationStatusHistory');

const NO_SHOW_REASON = 'Automatically marked No Show: not checked in after the reservation dates passed';

async function markNoShows() {
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const now = parseLocalDateTime(formatManilaDateTime().replace(' ', 'T'));
    if (!now) throw new Error('Unable to determine the current Manila time for No Show processing.');

    const [reservations] = await connection.query(
      `SELECT reservation_id, room_id, venue_id,
              DATE_FORMAT(check_out_date, '%Y-%m-%d') AS check_out_date,
              DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date,
              TIME_FORMAT(end_time, '%H:%i:%s') AS end_time
       FROM Reservations
       WHERE status = 'confirmed'
         AND actual_check_in IS NULL
         AND (
           (room_id IS NOT NULL AND check_out_date <= ?)
           OR (venue_id IS NOT NULL AND event_date <= ?)
         )
       FOR UPDATE`,
      [now.datePart, now.datePart]
    );

    const expired = reservations.filter((reservation) => {
      let cutoff;
      if (reservation.room_id !== null) {
        const checkoutHour = String(STANDARD_CHECK_OUT_HOUR).padStart(2, '0');
        cutoff = parseLocalDateTime(`${reservation.check_out_date}T${checkoutHour}:00:00`);
      } else {
        const endTime = reservation.end_time || '23:59:59';
        cutoff = parseLocalDateTime(`${reservation.event_date}T${endTime}`);
      }
      if (!cutoff) {
        throw new Error(`Unable to determine the scheduled end time for reservation ${reservation.reservation_id}.`);
      }
      return now.date.getTime() > cutoff.date.getTime();
    });

    if (expired.length === 0) {
      await connection.commit();
      transactionStarted = false;
      return 0;
    }

    const reservationIds = expired.map(({ reservation_id }) => reservation_id);
    const placeholders = reservationIds.map(() => '?').join(', ');
    const [result] = await connection.query(
      `UPDATE Reservations
       SET status = 'no_show'
       WHERE reservation_id IN (${placeholders})
         AND status = 'confirmed'
         AND actual_check_in IS NULL`,
      reservationIds
    );

    if (result.affectedRows !== reservationIds.length) {
      throw new Error(`Expected to mark ${reservationIds.length} reservations No Show, but updated ${result.affectedRows}.`);
    }

    for (const reservation of expired) {
      const { reservation_id: reservationId } = reservation;
      await recordReservationStatusHistory(
        connection,
        reservationId,
        'confirmed',
        'no_show',
        'system',
        null,
        NO_SHOW_REASON
      );
      await logAudit({
        connection,
        userId: null,
        action: ACTIONS.RESERVATION_NO_SHOW,
        entityType: ENTITY_TYPES.RESERVATION,
        entityId: reservationId,
        oldValue: { status: 'confirmed' },
        newValue: { status: 'no_show', actor_type: 'system', reason: NO_SHOW_REASON },
      });
    }

    await connection.commit();
    transactionStarted = false;
    console.log(`[markNoShows] Marked ${result.affectedRows} reservation(s) No Show.`);
    return result.affectedRows;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[markNoShows] Rollback error:', rollbackError.message);
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { markNoShows };
