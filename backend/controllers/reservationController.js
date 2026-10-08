const pool = require('../config/db');
const { HOLD_MINUTES } = require('../config/reservationConfig');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { calculateDeposit, fromCents, toCents } = require('../config/paymentPolicy');
const { publish } = require('../services/notificationHub');
const { ACTIVE_HOLD_CLAUSE, statusPlaceholders, statusParams } = require('../utils/reservationAvailability');
const { recordReservationStatusHistory } = require('../utils/reservationStatusHistory');
const { signReservationToken } = require('../utils/reservationToken');

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function createBookingReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const randomDigits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `KAB-${year}-${month}-${randomDigits}`;
}

async function createReservation(req, res, allowDeadlockRetry = true) {
  const { room_id, venue_id, check_in, check_out, event_date, num_guests, customer } = req.body;
  const startDate = venue_id !== undefined ? (event_date || check_in) : check_in;
  const requiredCustomerFields = ['first_name', 'last_name', 'email', 'phone_number', 'address'];

  if (
    (room_id === undefined && venue_id === undefined) ||
    !startDate ||
    (venue_id === undefined && !check_out) ||
    num_guests === undefined ||
    !customer ||
    requiredCustomerFields.some((field) => customer[field] === undefined || customer[field] === null || !String(customer[field]).trim())
  ) {
    return res.status(400).json({ error: 'room_id, check_in, check_out, num_guests, and all customer fields are required.' });
  }

  const roomId = room_id === undefined ? null : Number(room_id);
  const venueId = venue_id === undefined ? null : Number(venue_id);
  const guestCount = Number(num_guests);
  if ((roomId !== null && (!Number.isInteger(roomId) || roomId <= 0)) || (venueId !== null && (!Number.isInteger(venueId) || venueId <= 0)) || (roomId !== null && venueId !== null)) {
    return res.status(400).json({ error: 'room_id must be a valid room ID.' });
  }
  if (!isValidDateString(startDate) || (roomId !== null && !isValidDateString(check_out))) {
    return res.status(400).json({ error: 'check_in and check_out must use the YYYY-MM-DD format.' });
  }
  if (roomId !== null && check_out <= startDate) {
    return res.status(400).json({ error: 'check_out must be after check_in.' });
  }
  if (!Number.isInteger(guestCount) || guestCount <= 0) {
    return res.status(400).json({ error: 'num_guests must be a whole number greater than zero.' });
  }

  let connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock the room while checking conflicts so simultaneous bookings serialize per room.
    const [rooms] = roomId ? await connection.query(
      `SELECT room_id, status, price_per_night
       FROM Rooms
       WHERE room_id = ?
       FOR UPDATE`,
      [roomId]
    ) : [[]];
    const [venues] = venueId ? await connection.query('SELECT venue_id, capacity, status FROM Venues WHERE venue_id=? FOR UPDATE', [venueId]) : [[]];

    if ((roomId && rooms.length === 0) || (venueId && venues.length === 0)) {
      await connection.rollback();
      return res.status(404).json({ error: roomId ? 'Room not found.' : 'Venue not found.' });
    }

    if ((roomId && rooms[0].status !== 'available') || (venueId && venues[0].status !== 'available')) {
      await connection.rollback();
      return res.status(409).json({ error: roomId ? 'Room is not available for booking.' : 'Venue is not available for booking.' });
    }
    if (venueId && guestCount > venues[0].capacity) {
      await connection.rollback();
      return res.status(400).json({ error: `Guest count cannot exceed the venue capacity of ${venues[0].capacity}.` });
    }

    const [conflicts] = roomId ? await connection.query(
      `SELECT reservation_id
       FROM Reservations
       WHERE room_id = ?
         AND status IN (${statusPlaceholders()})
         AND ${ACTIVE_HOLD_CLAUSE}
         AND check_in_date < ?
         AND check_out_date > ?
       LIMIT 1`,
      [roomId, ...statusParams(), check_out, startDate]
    ) : await connection.query(
      `SELECT reservation_id FROM Reservations
       WHERE venue_id = ? AND status IN (${statusPlaceholders()}) AND ${ACTIVE_HOLD_CLAUSE}
       AND event_date = ? LIMIT 1`, [venueId, ...statusParams(), startDate]
    );

    if (conflicts.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'Room is already booked for part of the requested date range.' });
    }

    const customerValues = [
      String(customer.first_name).trim(),
      String(customer.last_name).trim(),
      String(customer.email).trim().toLowerCase(),
      String(customer.phone_number).trim(),
      String(customer.address).trim(),
    ];
    let customerId;
    if (req.user?.role === 'customer') {
      // Registered customer: use the session user and require an active account.
      customerId = req.user.user_id;
      const [customerRows] = await connection.query(
        'SELECT customer_id FROM Customer WHERE customer_id = ? AND is_active = TRUE FOR UPDATE',
        [customerId]
      );
      if (customerRows.length === 0) {
        await connection.rollback();
        return res.status(403).json({ error: 'Customer account is not active.' });
      }
      await connection.query(
        `UPDATE Customer
         SET first_name = ?, last_name = ?, phone_number = ?, address = ?
         WHERE customer_id = ?`,
        [customerValues[0], customerValues[1], customerValues[3], customerValues[4], customerId]
      );
    } else {
      // Guest booking: resolve an existing guest row by email, or insert a new one (inside the transaction).
      const [customerRows] = await connection.query(
        'SELECT customer_id, is_registered, password_hash FROM Customer WHERE email = ? LIMIT 1 FOR UPDATE',
        [customerValues[2]]
      );
      if (customerRows.length > 0) {
        const guestRow = customerRows[0];
        if (guestRow.is_registered === 1 || guestRow.password_hash !== null) {
          await connection.rollback();
          return res.status(409).json({ error: 'An account with this email already exists. Please log in to book.' });
        }
        customerId = guestRow.customer_id;
        await connection.query(
          `UPDATE Customer
           SET first_name = ?, last_name = ?, phone_number = ?, address = ?
           WHERE customer_id = ?`,
          [customerValues[0], customerValues[1], customerValues[3], customerValues[4], customerId]
        );
      } else {
        const [customerResult] = await connection.query(
          `INSERT INTO Customer
           (first_name, last_name, email, phone_number, address, password_hash, is_registered, is_active)
           VALUES (?, ?, ?, ?, ?, NULL, FALSE, TRUE)`,
          customerValues
        );
        customerId = customerResult.insertId;
      }
    }

    const nights = Math.round((Date.parse(`${check_out}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000);
    const totalAmount = roomId ? fromCents(toCents(rooms[0].price_per_night) * nights) : Number(req.body.total_amount || 0);
    const depositDue = fromCents(calculateDeposit(totalAmount));

    let reservationResult;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        [reservationResult] = await connection.query(
          `INSERT INTO Reservations
           (customer_id, room_id, venue_id, booking_source, booking_reference, hold_expires_at,
            check_in_date, check_out_date, event_date, num_guests, total_amount, status)
           VALUES (?, ?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, 'payment_pending')`,
          [customerId, roomId, venueId, createBookingReference(), new Date(Date.now() + HOLD_MINUTES * 60 * 1000), roomId ? startDate : null, roomId ? check_out : null, venueId ? startDate : null, guestCount, totalAmount]
        );
        break;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY' || attempt === 4) throw err;
      }
    }

    const [createdReservations] = await connection.query(
      `SELECT r.reservation_id, r.booking_reference, r.hold_expires_at, r.total_amount,
              c.first_name, c.last_name, rm.room_number
       FROM Reservations r
       INNER JOIN Customer c ON c.customer_id = r.customer_id
        LEFT JOIN Rooms rm ON rm.room_id = r.room_id
       WHERE reservation_id = ?`,
      [reservationResult.insertId]
    );
    await recordReservationStatusHistory(connection, reservationResult.insertId, null, 'payment_pending', 'customer', customerId);

    await logAudit({
      connection,
      userId: null,
      action: ACTIONS.RESERVATION_CREATE,
      entityType: ENTITY_TYPES.RESERVATION,
      entityId: reservationResult.insertId,
      newValue: {
        booking_reference: createdReservations[0].booking_reference,
        customer_id: customerId,
        room_id: roomId,
        check_in_date: check_in,
        check_out_date: check_out,
        status: 'payment_pending',
      },
      ipAddress: req.ip,
    });

    await connection.commit();

    try {
      publish({
        type: 'reservation_created',
        booking_reference: createdReservations[0].booking_reference,
        guest_name: `${createdReservations[0].first_name} ${createdReservations[0].last_name}`.trim(),
        resource_name: createdReservations[0].room_number,
        created_at: new Date().toISOString(),
      });
    } catch (notificationError) {
      console.error('[createReservation] Notification error:', notificationError.message);
    }

    return res.status(201).json({
      ...createdReservations[0],
      total: Number(createdReservations[0].total_amount),
      deposit_due: depositDue,
      balance_due: Number(createdReservations[0].total_amount) - depositDue,
      access_token: signReservationToken(reservationResult.insertId),
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('[createReservation] Rollback error:', rollbackError.message);
    }
    console.error('[createReservation] Error:', err.message);
    if (err.code === 'ER_LOCK_DEADLOCK' && allowDeadlockRetry) {
      connection.release();
      connection = null;
      return createReservation(req, res, false);
    }
    return res.status(500).json({ error: 'Failed to create reservation.' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { createReservation };
