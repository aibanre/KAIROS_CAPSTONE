const pool = require('../config/db');
const { HOLD_MINUTES, PLACEHOLDER_CUSTOMER_MARKER } = require('../config/reservationConfig');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { calculateDeposit, fromCents, toCents } = require('../config/paymentPolicy');
const { publish } = require('../services/notificationHub');
const { statusPlaceholders, statusParams, ACTIVE_HOLD_CLAUSE } = require('../utils/reservationAvailability');
const { recordReservationStatusHistory } = require('../utils/reservationStatusHistory');
const { signReservationToken, verifyReservationToken } = require('../utils/reservationToken');
const { validateBooking, computePrice, findConflicts, parseInclusions, timeValue, minutes } = require('../utils/venueBooking');
const { isBeforeEarliestBookableDate, earliestBookingMessage } = require('../utils/reservationDates');

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

function placeholderPhone() {
  return `${PLACEHOLDER_CUSTOMER_MARKER}-${require('crypto').randomBytes(6).toString('hex')}`;
}

function isPlaceholderCustomer(row) {
  return row?.first_name === PLACEHOLDER_CUSTOMER_MARKER
    || String(row?.phone_number || '').startsWith(`${PLACEHOLDER_CUSTOMER_MARKER}-`);
}

function holdTokenFromRequest(req) {
  const token = req.headers['x-reservation-token'] || req.body?.access_token;
  return typeof token === 'string' ? verifyReservationToken(token) : null;
}

async function ownedVenueHoldId(executor, req, venueId, eventDate) {
  if (req.user?.role !== 'customer') return null;
  const [[hold]] = await executor.query(
    `SELECT reservation_id
     FROM Reservations
     WHERE customer_id = ? AND venue_id = ? AND event_date = ?
       AND status = 'payment_pending'
       AND (hold_expires_at IS NULL OR hold_expires_at >= NOW())
     ORDER BY reservation_id DESC
     LIMIT 1`,
    [req.user.user_id, venueId, eventDate]
  );
  return hold?.reservation_id ?? null;
}

async function authorizeHold(connection, req, reservationId) {
  const [resourceRows] = await connection.query(
    `SELECT room_id, venue_id FROM Reservations WHERE reservation_id = ?`,
    [reservationId]
  );
  if (!resourceRows.length) return { error: { status: 404, message: 'Reservation not found.' } };
  if (resourceRows[0].room_id) {
    await connection.query('SELECT room_id FROM Rooms WHERE room_id = ? FOR UPDATE', [resourceRows[0].room_id]);
  } else if (resourceRows[0].venue_id) {
    await connection.query('SELECT venue_id FROM Venues WHERE venue_id = ? FOR UPDATE', [resourceRows[0].venue_id]);
  }
  const [rows] = await connection.query(
    `SELECT reservation_id, customer_id, status, hold_expires_at
     FROM Reservations WHERE reservation_id = ? FOR UPDATE`,
    [reservationId]
  );
  const reservation = rows[0];
  if (!reservation) return { error: { status: 404, message: 'Reservation not found.' } };
  if (req.user?.role === 'customer') {
    if (Number(req.user.user_id) !== Number(reservation.customer_id)) {
      return { error: { status: 403, message: 'You do not have permission to update this hold.' } };
    }
  } else {
    const token = holdTokenFromRequest(req);
    if (!token || Number(token.reservation_id) !== Number(reservationId)) {
      return { error: { status: 401, message: 'A valid reservation hold token is required.' } };
    }
  }
  if (reservation.status !== 'payment_pending') {
    return { error: { status: 409, message: `This hold is already ${reservation.status.replace('_', ' ')}.` } };
  }
  if (reservation.hold_expires_at && new Date(reservation.hold_expires_at) < new Date()) {
    return { error: { status: 410, message: 'Your hold has expired. Please choose your dates again.' } };
  }
  return { reservation };
}

async function createReservationHold(req, res, allowDeadlockRetry = true) {
  const { room_id, venue_id, check_in, check_out, event_date, start_time, package_id, num_guests, pax, children = 0 } = req.body;
  const roomId = room_id === undefined ? null : Number(room_id);
  const venueId = venue_id === undefined ? null : Number(venue_id);
  const isVenue = venueId !== null;
  const startDate = isVenue ? event_date : check_in;
  const guestCount = Number(num_guests);
  const rawVenueGuestCount = pax ?? num_guests;
  const venueGuestCount = rawVenueGuestCount === undefined || rawVenueGuestCount === null ? null : Number(rawVenueGuestCount);
  const childCount = Number(children);
  if (roomId === null && venueId === null) return res.status(400).json({ error: 'room_id or venue_id is required.' });
  if (roomId !== null && venueId !== null) return res.status(400).json({ error: 'Send either room_id or venue_id, not both.' });
  if (!Number.isInteger(isVenue ? venueId : roomId) || (isVenue ? venueId : roomId) <= 0) {
    return res.status(400).json({ error: `${isVenue ? 'venue_id' : 'room_id'} must be a positive integer.` });
  }
  if (!isValidDateString(startDate)) return res.status(400).json({ error: `${isVenue ? 'event_date' : 'check_in'} must use YYYY-MM-DD.` });
  if (isBeforeEarliestBookableDate(startDate)) return res.status(400).json({ error: earliestBookingMessage() });
  if (!isVenue && !isValidDateString(check_out)) return res.status(400).json({ error: 'check_out must use YYYY-MM-DD.' });
  if (!isVenue && check_out <= check_in) return res.status(400).json({ error: 'check_out must be after check_in.' });
  if (!isVenue && (!Number.isInteger(guestCount) || guestCount <= 0)) return res.status(400).json({ error: 'num_guests must be a whole number greater than zero.' });
  if (isVenue && start_time !== undefined && start_time !== null && !timeValue(start_time)) return res.status(400).json({ error: 'start_time must use HH:MM or HH:MM:SS.' });
  if (isVenue && venueGuestCount !== null && (!Number.isInteger(venueGuestCount) || venueGuestCount <= 0)) return res.status(400).json({ error: 'pax must be a whole number greater than zero.' });
  if (!Number.isInteger(childCount) || childCount < 0) return res.status(400).json({ error: 'children must be a whole number zero or greater.' });

  let connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rooms] = roomId ? await connection.query(
      'SELECT room_id, status, price_per_night, capacity FROM Rooms WHERE room_id = ? FOR UPDATE',
      [roomId]
    ) : [[]];
    const [venues] = venueId ? await connection.query(
      'SELECT * FROM Venues WHERE venue_id = ? FOR UPDATE',
      [venueId]
    ) : [[]];
    const resource = roomId ? rooms[0] : venues[0];
    if (!resource) {
      await connection.rollback();
      return res.status(404).json({ error: roomId ? 'Room not found.' : 'Venue not found.' });
    }
    if (resource.status !== 'available' || (roomId && guestCount > Number(resource.capacity)) || (venueId && venueGuestCount !== null && venueGuestCount > Number(resource.capacity))) {
      await connection.rollback();
      return res.status(409).json({ error: roomId && guestCount > Number(resource.capacity) ? 'The number of adults exceeds the room capacity.' : venueId && venueGuestCount !== null && venueGuestCount > Number(resource.capacity) ? 'The number of guests exceeds the venue capacity.' : `${roomId ? 'Room' : 'Venue'} is not available for booking.` });
    }

    let venueWindow = null;
    let provisionalTotal = 0;
    if (venueId) {
      const earliest = resource.booking_mode === 'day_use' ? resource.start_time : resource.earliest_start;
      const latest = resource.booking_mode === 'day_use' ? resource.end_time : resource.latest_end;
      const [packages] = package_id ? await connection.query(
        'SELECT * FROM Venue_Packages WHERE package_id = ? AND venue_id = ? AND is_active = TRUE FOR UPDATE',
        [package_id, venueId]
      ) : [[]];
      if (resource.booking_mode === 'packaged' && package_id !== undefined && package_id !== null && package_id !== '' && !packages[0]) {
        await connection.rollback();
        return res.status(400).json({ error: 'package_id is required for packaged venues.' });
      }
      const shouldValidatePackageHold = resource.booking_mode !== 'packaged' || (package_id !== undefined && package_id !== null && package_id !== '');
      const startTimeForHold = start_time && timeValue(start_time) ? start_time : (earliest || '08:00');
      venueWindow = shouldValidatePackageHold && start_time && timeValue(start_time)
        ? validateBooking(resource, packages[0] || null, startDate, start_time, venueGuestCount ?? 1, 0)
        : { valid: true, start: minutes(startTimeForHold), end: minutes(latest), startTime: timeValue(startTimeForHold), endTime: timeValue(latest), durationHours: (minutes(latest) - minutes(startTimeForHold)) / 60 };
      if (!venueWindow.valid) {
        await connection.rollback();
        return res.status(400).json({ error: venueWindow.reason });
      }
      const ownedHoldId = await ownedVenueHoldId(connection, req, venueId, startDate);
      const conflicts = await findConflicts(connection, venueId, startDate, venueWindow.start, venueWindow.end, Number(resource.buffer_minutes || 0), ownedHoldId);
      if (conflicts.length) {
        await connection.rollback();
        return res.status(409).json({ error: 'These dates were just taken. Please choose other dates.' });
      }
    }
    const [roomConflicts] = roomId ? await connection.query(
      `SELECT reservation_id FROM Reservations
       WHERE room_id = ? AND status IN (${statusPlaceholders()})
         AND ${ACTIVE_HOLD_CLAUSE}
         AND check_in_date < ? AND check_out_date > ? LIMIT 1 FOR UPDATE`,
      [roomId, ...statusParams(), check_out, check_in]
    ) : [[]];
    const conflicts = roomId ? roomConflicts : [];
    if (conflicts.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'These dates were just taken. Please choose other dates.' });
    }

    let customerId;
    let accessToken;
    if (req.user?.role === 'customer') {
      customerId = req.user.user_id;
      const [customers] = await connection.query(
        'SELECT customer_id FROM Customer WHERE customer_id = ? AND is_active = TRUE FOR UPDATE',
        [customerId]
      );
      if (!customers.length) {
        await connection.rollback();
        return res.status(403).json({ error: 'Customer account is not active.' });
      }
      const [activeHolds] = await connection.query(
        `SELECT reservation_id, room_id, venue_id, check_in_date, check_out_date, event_date
         FROM Reservations
         WHERE customer_id = ? AND status = 'payment_pending'
           AND (hold_expires_at IS NULL OR hold_expires_at >= NOW()) LIMIT 1 FOR UPDATE`,
        [customerId]
      );
      const existing = activeHolds[0];
      const identical = existing && (
        (roomId && Number(existing.room_id) === roomId
          && new Date(existing.check_in_date).toISOString().slice(0, 10) === check_in
          && new Date(existing.check_out_date).toISOString().slice(0, 10) === check_out)
        || (venueId && Number(existing.venue_id) === venueId
          && new Date(existing.event_date).toISOString().slice(0, 10) === startDate)
      );
      if (identical) {
        const [existingRows] = await connection.query(
          'SELECT reservation_id, booking_reference, hold_expires_at FROM Reservations WHERE reservation_id = ?',
          [existing.reservation_id]
        );
        await connection.commit();
        return res.status(201).json({
          ...existingRows[0],
          check_in_date: check_in,
          check_out_date: check_out,
          event_date: startDate,
          server_time: new Date().toISOString(),
          access_token: null,
        });
      }
      for (const activeHold of activeHolds) {
        await connection.query(
          `UPDATE Reservations SET status = 'cancelled', cancellation_reason = 'Replaced by a new customer hold.'
           WHERE reservation_id = ? AND status = 'payment_pending'`,
          [activeHold.reservation_id]
        );
        await recordReservationStatusHistory(connection, activeHold.reservation_id, 'payment_pending', 'cancelled', 'customer', customerId, 'Replaced by a new customer hold.');
      }
    } else {
      const previousToken = holdTokenFromRequest(req);
      if (previousToken) {
        const [previous] = await connection.query(
          `SELECT reservation_id FROM Reservations
           WHERE reservation_id = ? AND status = 'payment_pending'
             AND (hold_expires_at IS NULL OR hold_expires_at >= NOW()) FOR UPDATE`,
          [previousToken.reservation_id]
        );
        if (previous.length) {
          await connection.rollback();
          return res.status(409).json({ error: 'You already have an active hold. Continue that booking or release it first.' });
        }
      }
      const [customerResult] = await connection.query(
        `INSERT INTO Customer
         (first_name, last_name, email, phone_number, address, password_hash, is_registered, is_active)
         VALUES (?, ?, NULL, ?, NULL, NULL, FALSE, TRUE)`,
        [PLACEHOLDER_CUSTOMER_MARKER, PLACEHOLDER_CUSTOMER_MARKER, placeholderPhone()]
      );
      customerId = customerResult.insertId;
    }

    const nights = roomId ? Math.round((Date.parse(`${check_out}T00:00:00Z`) - Date.parse(`${check_in}T00:00:00Z`)) / 86400000) : 0;
    const totalAmount = roomId ? fromCents(toCents(rooms[0].price_per_night) * nights) : provisionalTotal;
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
    const [result] = await connection.query(
      `INSERT INTO Reservations
       (customer_id, room_id, venue_id, booking_source, booking_reference, hold_expires_at,
        check_in_date, check_out_date, event_date, start_time, end_time, duration_hours,
        num_guests, children, pax, total_amount, status)
       VALUES (?, ?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'payment_pending')`,
      [customerId, roomId, venueId, createBookingReference(), expiresAt,
        roomId ? startDate : null, roomId ? check_out : null, venueId ? startDate : null,
        venueId ? venueWindow.startTime : null, venueId ? venueWindow.endTime : null,
        venueId ? venueWindow.durationHours : null, isVenue ? (venueGuestCount ?? null) : guestCount,
        childCount, isVenue ? (venueGuestCount ?? null) : null, totalAmount]
    );
    await recordReservationStatusHistory(connection, result.insertId, null, 'payment_pending', 'customer', customerId);
    await connection.commit();
    accessToken = req.user?.role === 'customer' ? null : signReservationToken(result.insertId);
    return res.status(201).json({
      reservation_id: result.insertId,
      booking_reference: (await pool.query('SELECT booking_reference FROM Reservations WHERE reservation_id = ?', [result.insertId]))[0][0].booking_reference,
      hold_expires_at: expiresAt,
      check_in_date: roomId ? check_in : null,
      check_out_date: roomId ? check_out : null,
      event_date: venueId ? event_date : null,
      start_time: venueId ? venueWindow.startTime : null,
      end_time: venueId ? venueWindow.endTime : null,
      server_time: new Date().toISOString(),
      access_token: accessToken,
    });
  } catch (err) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('[createReservationHold] Rollback error:', rollbackError.message); }
    if (err.code === 'ER_LOCK_DEADLOCK' && allowDeadlockRetry) {
      connection.release();
      connection = null;
      return createReservationHold(req, res, false);
    }
    console.error('[createReservationHold] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create reservation hold.' });
  } finally {
    if (connection) connection.release();
  }
}

async function updateReservationHold(req, res, allowDeadlockRetry = true) {
  const reservationId = Number(req.params.id);
  const { first_name, last_name, email, phone_number, address, num_guests, children, event_date, start_time, package_id, pax, extra_hours } = req.body;
  if (!Number.isInteger(reservationId) || reservationId <= 0
    || [first_name, last_name, email, phone_number, address].some((value) => !String(value || '').trim())) {
    return res.status(400).json({ error: 'All customer fields are required.' });
  }
  let connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const authorized = await authorizeHold(connection, req, reservationId);
    if (authorized.error) {
      await connection.rollback();
      return res.status(authorized.error.status).json({ error: authorized.error.message });
    }
    const reservation = authorized.reservation;
    const [reservationDetails] = await connection.query(
      'SELECT room_id, venue_id FROM Reservations WHERE reservation_id = ? FOR UPDATE',
      [reservationId]
    );
    if (reservationDetails[0]?.venue_id) {
      const venueId = reservationDetails[0].venue_id;
      const requestedDate = event_date || null;
      const requestedPax = Number(pax ?? num_guests);
      const normalizedExtraHours = extra_hours === undefined || extra_hours === null ? 0 : Number(extra_hours);
      if (!isValidDateString(requestedDate) || !timeValue(start_time)
        || !Number.isInteger(requestedPax) || requestedPax <= 0
        || !Number.isInteger(normalizedExtraHours) || normalizedExtraHours < 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'A valid venue date, time, guest count, and extra hours are required.' });
      }
      if (isBeforeEarliestBookableDate(requestedDate)) {
        await connection.rollback();
        return res.status(400).json({ error: earliestBookingMessage() });
      }
      const [venues] = await connection.query('SELECT * FROM Venues WHERE venue_id = ? FOR UPDATE', [venueId]);
      const [packages] = package_id ? await connection.query(
        'SELECT * FROM Venue_Packages WHERE package_id = ? AND venue_id = ? AND is_active = TRUE FOR UPDATE',
        [package_id, venueId]
      ) : [[]];
      const venueBooking = validateBooking(venues[0], packages[0] || null, requestedDate, start_time, requestedPax, normalizedExtraHours);
      if (!venueBooking.valid) {
        await connection.rollback();
        return res.status(400).json({ error: venueBooking.reason });
      }
      const conflicts = await findConflicts(connection, venueId, requestedDate, venueBooking.start, venueBooking.end, Number(venues[0].buffer_minutes || 0), reservationId);
      if (conflicts.length) {
        await connection.rollback();
        return res.status(409).json({ error: 'These dates were just taken. Please choose other dates.' });
      }
      const venuePrice = computePrice(venues[0], packages[0] || null, requestedPax, normalizedExtraHours);
      await connection.query(
        `UPDATE Reservations SET event_date = ?, start_time = ?, end_time = ?, duration_hours = ?,
         num_guests = ?, pax = ?, package_id = ?, package_name = ?, package_inclusions = ?,
         unit_price = ?, pricing_type = ?, extra_hours = ?, total_amount = ?
         WHERE reservation_id = ?`,
        [requestedDate, venueBooking.startTime, venueBooking.endTime, venueBooking.durationHours,
          requestedPax, requestedPax, package_id || null, packages[0]?.package_name || null,
          JSON.stringify(parseInclusions(packages[0]?.inclusions)), venuePrice.unit_price,
          venuePrice.pricing_type, venuePrice.extra_hours, venuePrice.total, reservationId]
      );
    } else if (num_guests !== undefined || children !== undefined) {
      const nextGuests = Number(num_guests);
      const nextChildren = Number(children || 0);
      if (!Number.isInteger(nextGuests) || nextGuests <= 0 || !Number.isInteger(nextChildren) || nextChildren < 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Guest counts must be whole numbers greater than or equal to zero.' });
      }
      await connection.query('UPDATE Reservations SET num_guests = ?, children = ? WHERE reservation_id = ?', [nextGuests, nextChildren, reservationId]);
    }
    const [customerRows] = await connection.query(
      'SELECT * FROM Customer WHERE customer_id = ? FOR UPDATE',
      [reservation.customer_id]
    );
    const placeholder = isPlaceholderCustomer(customerRows[0]);
    const normalizedEmail = String(email).trim().toLowerCase();
    const [matches] = await connection.query(
      `SELECT * FROM Customer
       WHERE (email = ? OR phone_number = ?)
         AND customer_id <> ?
         AND first_name <> ? AND phone_number NOT LIKE ?
       LIMIT 1 FOR UPDATE`,
      [normalizedEmail, String(phone_number).trim(), reservation.customer_id, PLACEHOLDER_CUSTOMER_MARKER, `${PLACEHOLDER_CUSTOMER_MARKER}-%`]
    );
    const matchingCustomer = matches[0];
    if (matchingCustomer?.is_registered) {
      await connection.rollback();
      return res.status(409).json({ error: 'An account with this email already exists. Please log in to book.' });
    }
    let customerId = reservation.customer_id;
    if (matchingCustomer && matchingCustomer.customer_id !== reservation.customer_id) {
      customerId = matchingCustomer.customer_id;
      await connection.query(
        'UPDATE Reservations SET customer_id = ? WHERE reservation_id = ?',
        [customerId, reservationId]
      );
      await connection.query(
        `UPDATE Reservation_Status_History
         SET changed_by_customer_id = ?
         WHERE changed_by_customer_id = ?`,
        [customerId, reservation.customer_id]
      );
      if (placeholder) {
        const [[referenceCounts]] = await connection.query(
          `SELECT
             (SELECT COUNT(*) FROM Reservations WHERE customer_id = ?) AS reservation_count,
             (SELECT COUNT(*) FROM Reservation_Status_History WHERE changed_by_customer_id = ?) AS status_history_count,
             (SELECT COUNT(*) FROM Reviews WHERE customer_id = ?) AS review_count,
             (SELECT COUNT(*) FROM PasswordResetTokens WHERE customer_id = ?) AS password_reset_count,
             (SELECT COUNT(*) FROM Chatbot_Conversations WHERE customer_id = ?) AS chatbot_conversation_count`,
          [
            reservation.customer_id,
            reservation.customer_id,
            reservation.customer_id,
            reservation.customer_id,
            reservation.customer_id,
          ]
        );
        if (Object.values(referenceCounts).every((count) => Number(count) === 0)) {
          await connection.query('DELETE FROM Customer WHERE customer_id = ?', [reservation.customer_id]);
        }
      }
    }
    await connection.query(
      `UPDATE Customer SET first_name = ?, last_name = ?, email = ?, phone_number = ?, address = ?
       WHERE customer_id = ?`,
      [String(first_name).trim(), String(last_name).trim(), normalizedEmail, String(phone_number).trim(), String(address).trim(), customerId]
    );
    const [updated] = await connection.query(
      'SELECT reservation_id, booking_reference, hold_expires_at, total_amount FROM Reservations WHERE reservation_id = ?',
      [reservationId]
    );
    await connection.commit();
    return res.status(200).json({ ...updated[0], server_time: new Date().toISOString() });
  } catch (err) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('[updateReservationHold] Rollback error:', rollbackError.message); }
    if (err.code === 'ER_LOCK_DEADLOCK' && allowDeadlockRetry) {
      connection.release();
      connection = null;
      return updateReservationHold(req, res, false);
    }
    console.error('[updateReservationHold] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update reservation hold.' });
  } finally {
    if (connection) connection.release();
  }
}

async function releaseReservationHold(req, res) {
  const reservationId = Number(req.params.id);
  if (!Number.isInteger(reservationId) || reservationId <= 0) return res.status(400).json({ error: 'Invalid reservation ID.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const authorized = await authorizeHold(connection, req, reservationId);
    if (authorized.error) {
      await connection.rollback();
      return res.status(authorized.error.status).json({ error: authorized.error.message });
    }
    await connection.query(
      `UPDATE Reservations SET status = 'cancelled', cancellation_reason = 'Hold released by customer.'
       WHERE reservation_id = ? AND status = 'payment_pending'`,
      [reservationId]
    );
    await recordReservationStatusHistory(connection, reservationId, 'payment_pending', 'cancelled', 'customer', authorized.reservation.customer_id, 'Hold released by customer.');
    await connection.commit();
    return res.status(204).send();
  } catch (err) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('[releaseReservationHold] Rollback error:', rollbackError.message); }
    console.error('[releaseReservationHold] Error:', err.message);
    return res.status(500).json({ error: 'Failed to release reservation hold.' });
  } finally {
    connection.release();
  }
}

async function createReservation(req, res, allowDeadlockRetry = true) {
  const { room_id, venue_id, check_in, check_out, event_date, start_time, package_id, pax, extra_hours, num_guests, children, customer } = req.body;
  const startDate = venue_id !== undefined ? (event_date || check_in) : check_in;
  const requiredCustomerFields = ['first_name', 'last_name', 'email', 'phone_number', 'address'];

  if (
    (room_id === undefined && venue_id === undefined) ||
    !startDate ||
    (venue_id === undefined && !check_out) ||
    (num_guests === undefined && pax === undefined) ||
    !customer ||
    requiredCustomerFields.some((field) => customer[field] === undefined || customer[field] === null || !String(customer[field]).trim())
  ) {
    return res.status(400).json({ error: 'room_id, check_in, check_out, num_guests, and all customer fields are required.' });
  }

  const roomId = room_id === undefined ? null : Number(room_id);
  const venueId = venue_id === undefined ? null : Number(venue_id);
  const normalizedExtraHours = venueId === null
    ? 0
    : (extra_hours === undefined || extra_hours === null ? 0 : Number(extra_hours));
  const guestCount = Number(venue_id !== undefined ? (pax ?? num_guests) : num_guests);
  const childCount = children === undefined || children === null || children === ''
    ? 0
    : (typeof children === 'number'
      ? children
      : (typeof children === 'string' && /^\d+$/.test(children.trim()) ? Number(children) : NaN));
  if ((roomId !== null && (!Number.isInteger(roomId) || roomId <= 0)) || (venueId !== null && (!Number.isInteger(venueId) || venueId <= 0)) || (roomId !== null && venueId !== null)) {
    return res.status(400).json({ error: 'room_id or venue_id must be a valid resource ID.' });
  }
  if (!isValidDateString(startDate) || (roomId !== null && !isValidDateString(check_out))) {
    return res.status(400).json({ error: 'check_in and check_out must use the YYYY-MM-DD format.' });
  }
  if (isBeforeEarliestBookableDate(startDate)) return res.status(400).json({ error: earliestBookingMessage() });
  if (roomId !== null && check_out <= startDate) {
    return res.status(400).json({ error: 'check_out must be after check_in.' });
  }
  if (!Number.isInteger(guestCount) || guestCount <= 0) {
    return res.status(400).json({ error: 'num_guests must be a whole number greater than zero.' });
  }
  if (!Number.isInteger(childCount) || childCount < 0) {
    return res.status(400).json({ error: 'children must be a whole number greater than or equal to zero.' });
  }

  let connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock the room while checking conflicts so simultaneous bookings serialize per room.
    const [rooms] = roomId ? await connection.query(
      `SELECT room_id, status, price_per_night, capacity
       FROM Rooms
       WHERE room_id = ?
       FOR UPDATE`,
      [roomId]
    ) : [[]];
    const [venues] = venueId ? await connection.query('SELECT * FROM Venues WHERE venue_id=? FOR UPDATE', [venueId]) : [[]];

    if ((roomId && rooms.length === 0) || (venueId && venues.length === 0)) {
      await connection.rollback();
      return res.status(404).json({ error: roomId ? 'Room not found.' : 'Venue not found.' });
    }

    if ((roomId && rooms[0].status !== 'available') || (venueId && venues[0].status !== 'available')) {
      await connection.rollback();
      return res.status(409).json({ error: roomId ? 'Room is not available for booking.' : 'Venue is not available for booking.' });
    }
    if (roomId && guestCount > Number(rooms[0].capacity)) {
      await connection.rollback();
      return res.status(400).json({ error: 'The number of adults exceeds the room capacity.' });
    }
    let venueBooking;
    let venuePackage;
    let venuePrice;
    let ownedHoldId = null;
    if (venueId) {
      const [packages] = package_id ? await connection.query('SELECT * FROM Venue_Packages WHERE package_id = ? AND venue_id = ? AND is_active = TRUE FOR UPDATE', [package_id, venueId]) : [[]];
      venuePackage = packages[0] || null;
      venueBooking = validateBooking(venues[0], venuePackage, startDate, start_time, guestCount, normalizedExtraHours);
      if (!venueBooking.valid) {
        await connection.rollback();
        return res.status(400).json({ error: venueBooking.reason });
      }
      venuePrice = computePrice(venues[0], venuePackage, guestCount, normalizedExtraHours);
      ownedHoldId = await ownedVenueHoldId(connection, req, venueId, startDate);
    }

    const conflicts = roomId
      ? (await connection.query(
        `SELECT reservation_id
         FROM Reservations
         WHERE room_id = ?
           AND status IN (${statusPlaceholders()})
           AND ${ACTIVE_HOLD_CLAUSE}
           AND check_in_date < ?
           AND check_out_date > ?
         LIMIT 1
         FOR UPDATE`,
        [roomId, ...statusParams(), check_out, startDate]
      ))[0]
      : await findConflicts(connection, venueId, startDate, venueBooking.start, venueBooking.end, Number(venues[0].buffer_minutes || 0), ownedHoldId);

    if (conflicts.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: venueId ? 'That time slot is no longer available.' : 'Selected dates are no longer available.' });
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
        'SELECT customer_id, email FROM Customer WHERE customer_id = ? AND is_active = TRUE FOR UPDATE',
        [customerId]
      );
      if (customerRows.length === 0) {
        await connection.rollback();
        return res.status(403).json({ error: 'Customer account is not active.' });
      }
      customerValues[2] = customerRows[0].email;
      await connection.query(
        `UPDATE Customer
         SET first_name = ?, last_name = ?, phone_number = ?, address = ?
         WHERE customer_id = ?`,
        [customerValues[0], customerValues[1], customerValues[3], customerValues[4], customerId]
      );
    } else {
      // Guest booking: resolve an existing guest row by email, or insert a new one (inside the transaction).
      const [customerRows] = await connection.query(
        `SELECT customer_id, is_registered, password_hash FROM Customer
         WHERE email = ? AND first_name <> ? AND phone_number NOT LIKE ?
         LIMIT 1 FOR UPDATE`,
        [customerValues[2], PLACEHOLDER_CUSTOMER_MARKER, `${PLACEHOLDER_CUSTOMER_MARKER}-%`]
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
    const totalAmount = roomId ? fromCents(toCents(rooms[0].price_per_night) * nights) : venuePrice.total;
    const depositDue = fromCents(calculateDeposit(totalAmount));

    let reservationResult;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        [reservationResult] = await connection.query(
          `INSERT INTO Reservations
           (customer_id, room_id, venue_id, booking_source, booking_reference, hold_expires_at,
            check_in_date, check_out_date, event_date, start_time, end_time, duration_hours, num_guests, children, pax,
            package_id, package_name, package_inclusions, unit_price, pricing_type, extra_hours, total_amount, status)
            VALUES (?, ?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'payment_pending')`,
          [customerId, roomId, venueId, createBookingReference(), new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
             roomId ? startDate : null, roomId ? check_out : null, venueId ? startDate : null,
             venueId ? venueBooking.startTime : null, venueId ? venueBooking.endTime : null, venueId ? venueBooking.durationHours : null,
             guestCount, childCount, venueId ? guestCount : null, venueId ? package_id || null : null,
             venueId ? venuePackage?.package_name || null : null, venueId ? JSON.stringify(parseInclusions(venuePackage?.inclusions)) : null,
             venueId ? venuePrice.unit_price : null, venueId ? venuePrice.pricing_type : null, venueId ? venuePrice.extra_hours : 0, totalAmount]
        );
        break;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY' || attempt === 4) throw err;
      }
    }

    const [createdReservations] = await connection.query(
      `SELECT r.reservation_id, r.booking_reference, r.hold_expires_at, r.total_amount,
              DATE_FORMAT(r.event_date, '%Y-%m-%d') AS event_date,
              TIME_FORMAT(r.start_time, '%H:%i:%s') AS start_time,
              TIME_FORMAT(r.end_time, '%H:%i:%s') AS end_time,
              r.duration_hours, r.pax, r.num_guests, r.children, r.package_name, r.package_inclusions,
              r.unit_price, r.pricing_type, r.extra_hours,
              c.first_name, c.last_name, rm.room_number, v.venue_name
       FROM Reservations r
       INNER JOIN Customer c ON c.customer_id = r.customer_id
        LEFT JOIN Rooms rm ON rm.room_id = r.room_id
        LEFT JOIN Venues v ON v.venue_id = r.venue_id
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
        venue_id: venueId,
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
        resource_name: createdReservations[0].room_number || createdReservations[0].venue_name,
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

module.exports = {
  createReservation,
  createReservationHold,
  updateReservationHold,
  releaseReservationHold,
  isPlaceholderCustomer,
};
