// controllers/roomController.js
const pool = require('../config/db');
const { ACTIVE_HOLD_CLAUSE } = require('../utils/reservationAvailability');
const { REVIEW_STATS_SELECT, reviewStatsJoin, queryWithReviewStats } = require('../utils/reviewStats');
const { isBeforeEarliestBookableDate, earliestBookingMessage } = require('../utils/reservationDates');
const { getRoomGroup } = require('../utils/resourceGroups');

// Reservation statuses that "hold" a room and block availability.
// Cancelled/rejected/completed reservations do NOT block new bookings.
const BLOCKING_STATUSES = [
  'payment_pending',
  'pending_verification',
  'confirmed',
  'checked_in',
];

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function listRooms(req, res) {
  try {
    const rooms = await queryWithReviewStats(
      `SELECT r.*, ${REVIEW_STATS_SELECT}
       FROM Rooms r
       ${reviewStatsJoin('room_id')}
       ORDER BY r.price_per_night ASC`,
      `SELECT * FROM Rooms ORDER BY price_per_night ASC`
    );

    return res.status(200).json({ rooms });
  } catch (err) {
    console.error('[listRooms] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
}

async function getRoom(req, res) {
  try {
    const rooms = await queryWithReviewStats(
      `SELECT r.*, ${REVIEW_STATS_SELECT}
       FROM Rooms r
       ${reviewStatsJoin('room_id')}
       WHERE r.room_id = ?`,
      `SELECT * FROM Rooms WHERE room_id = ?`,
      [req.params.id]
    );

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    return res.status(200).json({ room: rooms[0] });
  } catch (err) {
    console.error('[getRoom] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch room.' });
  }
}

/**
 * GET /api/rooms/availability?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&room_type=&capacity=
 *
 * Returns all rooms that are:
 *  - status = 'available' (not under maintenance / deactivated)
 *  - AND have no overlapping reservation for the requested date range
 */
async function checkRoomAvailability(req, res) {
  const { check_in, check_out, room_type, capacity } = req.query;

  // ---- Validation ----
  if (!check_in || !check_out) {
    return res.status(400).json({
      error: 'check_in and check_out dates are required (format: YYYY-MM-DD).',
    });
  }

  const checkInDate = new Date(check_in);
  const checkOutDate = new Date(check_out);

  if (isNaN(checkInDate) || isNaN(checkOutDate)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }
  if (isBeforeEarliestBookableDate(check_in)) {
    return res.status(400).json({ error: earliestBookingMessage() });
  }

  if (checkOutDate <= checkInDate) {
    return res.status(400).json({ error: 'check_out must be after check_in.' });
  }

  try {
    // Build the base query — rooms that are administratively available
    let query = `
      SELECT r.*
      FROM Rooms r
      WHERE r.status = 'available'
    `;
    const params = [];

    if (room_type) {
      query += ` AND r.room_type = ?`;
      params.push(room_type);
    }

    if (capacity) {
      query += ` AND r.capacity >= ?`;
      params.push(Number(capacity));
    }

    // Exclude rooms that have an overlapping, still-active reservation
    query += `
      AND r.room_id NOT IN (
        SELECT res.room_id
        FROM Reservations res
        WHERE res.room_id IS NOT NULL
          AND res.status IN (${BLOCKING_STATUSES.map(() => '?').join(',')})
          AND ${ACTIVE_HOLD_CLAUSE}
          AND res.check_in_date < ?
          AND res.check_out_date > ?
      )
      ORDER BY r.price_per_night ASC
    `;
    params.push(...BLOCKING_STATUSES, check_out, check_in);

    const availableRooms = await queryWithReviewStats(
      query.replace('SELECT r.*', `SELECT r.*, ${REVIEW_STATS_SELECT}`).replace('FROM Rooms r', `FROM Rooms r ${reviewStatsJoin('room_id')}`),
      query,
      params
    );

    return res.status(200).json({
      check_in,
      check_out,
      count: availableRooms.length,
      rooms: availableRooms,
    });
  } catch (err) {
    console.error('[checkRoomAvailability] Error:', err.message);
    return res.status(500).json({ error: 'Failed to check room availability.' });
  }
}

/**
 * GET /api/rooms/:id/availability?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD
 *
 * Checks a SINGLE specific room for availability in a date range.
 * Useful right before creating a reservation, to re-confirm nothing
 * else booked it in the meantime.
 */
async function checkSingleRoomAvailability(req, res) {
  const { id } = req.params;
  const { check_in, check_out } = req.query;

  if (!check_in || !check_out) {
    return res.status(400).json({
      error: 'check_in and check_out dates are required (format: YYYY-MM-DD).',
    });
  }

  try {
    const [rooms] = await pool.query(
      `SELECT * FROM Rooms WHERE room_id = ?`,
      [id]
    );

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const room = rooms[0];

    if (room.status !== 'available') {
      return res.status(200).json({ available: false, reason: 'Room is not active/available.' });
    }

    const [conflicts] = await pool.query(
      `
      SELECT reservation_id FROM Reservations
      WHERE room_id = ?
        AND status IN (${BLOCKING_STATUSES.map(() => '?').join(',')})
        AND ${ACTIVE_HOLD_CLAUSE}
        AND check_in_date < ?
        AND check_out_date > ?
      `,
      [id, ...BLOCKING_STATUSES, check_out, check_in]
    );

    const isAvailable = conflicts.length === 0;

    return res.status(200).json({
      available: isAvailable,
      reason: isAvailable ? null : 'Room is already booked for part of this date range.',
      room,
    });
  } catch (err) {
    console.error('[checkSingleRoomAvailability] Error:', err.message);
    return res.status(500).json({ error: 'Failed to check room availability.' });
  }
}

/**
 * GET /api/rooms/:id/booked-dates?year=2026&month=9
 *
 * Returns every individual calendar day in the given month that is
 * covered by an active (blocking) reservation for this room.
 * Used to shade out booked days on a calendar UI.
 */
async function getBookedDatesForMonth(req, res) {
  const { id } = req.params;
  const { year, month } = req.query; // month is 1-12 (human-friendly)

  if (!year || !month) {
    return res.status(400).json({ error: 'year and month query params are required.' });
  }

  const yearNum = Number(year);
  const monthNum = Number(month);

  if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return res.status(400).json({ error: 'Invalid year or month.' });
  }

  try {
    if (req.query.group === '1') {
      const group = await getRoomGroup(pool, id);
      if (!group) return res.status(404).json({ error: 'Room not found.' });
      const units = group.groupUnits;
      const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
      const nextMonth = new Date(Date.UTC(yearNum, monthNum, 1));
      const monthEndExclusive = nextMonth.toISOString().slice(0, 10);
      const [reservations] = await pool.query(
        `SELECT room_id,
                DATE_FORMAT(check_in_date, '%Y-%m-%d') AS check_in_date,
                DATE_FORMAT(check_out_date, '%Y-%m-%d') AS check_out_date
         FROM Reservations
         WHERE room_id IN (${units.map(() => '?').join(',')})
           AND status IN (${BLOCKING_STATUSES.map(() => '?').join(',')})
           AND ${ACTIVE_HOLD_CLAUSE}
           AND check_in_date < ? AND check_out_date > ?`,
        [...units.map((room) => room.room_id), ...BLOCKING_STATUSES, monthEndExclusive, monthStart],
      );
      const blockedByUnit = new Map(units.map((unit) => [Number(unit.room_id), new Set()]));
      for (const reservation of reservations) {
        const days = blockedByUnit.get(Number(reservation.room_id));
        const checkIn = dateOnly(reservation.check_in_date);
        const checkOut = dateOnly(reservation.check_out_date);
        const cursor = new Date(`${checkIn < monthStart ? monthStart : checkIn}T00:00:00Z`);
        const end = new Date(`${checkOut > monthEndExclusive ? monthEndExclusive : checkOut}T00:00:00Z`);
        while (cursor < end) {
          days.add(cursor.toISOString().slice(0, 10));
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }
      const bookedDates = [];
      for (let day = 1; day <= new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate(); day += 1) {
        const date = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (units.every((unit) => unit.status !== 'available' || blockedByUnit.get(Number(unit.room_id)).has(date))) {
          bookedDates.push(date);
        }
      }
      return res.status(200).json({ room_id: Number(id), year: yearNum, month: monthNum, bookedDates });
    }

    // First and last calendar day of the requested month
    const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate(); // day 0 of next month = last day of this month
    const monthEnd = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [reservations] = await pool.query(
      `
      SELECT check_in_date, check_out_date
      FROM Reservations
      WHERE room_id = ?
        AND status IN (${BLOCKING_STATUSES.map(() => '?').join(',')})
        AND ${ACTIVE_HOLD_CLAUSE}
        AND check_in_date <= ?
        AND check_out_date >= ?
      `,
      [id, ...BLOCKING_STATUSES, monthEnd, monthStart]
    );

    // Expand each reservation's date range into individual day strings,
    // clipped to only the days that actually fall within this month.
    const bookedDatesSet = new Set();

    for (const res of reservations) {
      const start = new Date(Math.max(new Date(res.check_in_date), new Date(monthStart)));
      const end = new Date(Math.min(new Date(res.check_out_date), new Date(monthEnd)));

      // check_out_date itself is the day the guest leaves, so the room
      // is free again that day — we stop the day BEFORE check_out.
      const cursor = new Date(start);
      while (cursor < end) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        bookedDatesSet.add(`${y}-${m}-${d}`);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return res.status(200).json({
      room_id: Number(id),
      year: yearNum,
      month: monthNum,
      bookedDates: Array.from(bookedDatesSet).sort(),
    });
  } catch (err) {
    console.error('[getBookedDatesForMonth] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch booked dates.' });
  }
}

/**
 * GET /api/availability/booked-dates?year=2026&month=9
 *
 * Returns calendar days on which every administratively available room is
 * covered by an active reservation.
 * Used by the resort-wide availability calendar.
 */
async function getResortWideBookedDates(req, res) {
  const { year, month } = req.query;

  if (!year || !month) {
    return res.status(400).json({ error: 'year and month query params are required.' });
  }

  const yearNum = Number(year);
  const monthNum = Number(month);

  if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return res.status(400).json({ error: 'Invalid year or month.' });
  }

  try {
    const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const nextMonth = new Date(yearNum, monthNum, 1);
    const monthEndExclusive = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const [reservations] = await pool.query(
      `
      SELECT res.room_id, res.check_in_date, res.check_out_date
      FROM Reservations res
      INNER JOIN Rooms r ON r.room_id = res.room_id
      WHERE r.status = 'available'
        AND res.status IN (${BLOCKING_STATUSES.map(() => '?').join(',')})
        AND (res.status <> 'payment_pending' OR res.hold_expires_at IS NULL OR res.hold_expires_at >= NOW())
        AND res.check_in_date < ?
        AND res.check_out_date > ?
      `,
      [...BLOCKING_STATUSES, monthEndExclusive, monthStart]
    );

    const [availableRoomRows] = await pool.query("SELECT COUNT(*) AS count FROM Rooms WHERE status = 'available'");
    const availableRoomCount = Number(availableRoomRows[0]?.count || 0);
    const occupancyByDate = new Map();

    for (const reservation of reservations) {
      const start = new Date(Math.max(new Date(reservation.check_in_date), new Date(monthStart)));
      const end = new Date(Math.min(new Date(reservation.check_out_date), new Date(monthEndExclusive)));
      const cursor = new Date(start);

      while (cursor < end) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        const roomsForDate = occupancyByDate.get(key) || new Set();
        roomsForDate.add(reservation.room_id);
        occupancyByDate.set(key, roomsForDate);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return res.status(200).json({
      year: yearNum,
      month: monthNum,
      bookedDates: Array.from(occupancyByDate.entries())
        .filter(([, roomIds]) => availableRoomCount > 0 && roomIds.size >= availableRoomCount)
        .map(([date]) => date)
        .sort(),
    });
  } catch (err) {
    console.error('[getResortWideBookedDates] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch booked dates.' });
  }
}

module.exports = {
  listRooms,
  getRoom,
  checkRoomAvailability,
  checkSingleRoomAvailability,
  getBookedDatesForMonth,
  getResortWideBookedDates,
};