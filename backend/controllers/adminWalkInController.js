const pool = require('../config/db');
const { uploadImageToCloudinary, deleteImageFromCloudinary } = require('../utils/cloudinaryUpload');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { getSchemaAvailability } = require('../utils/paymentSummary');
const { calculateDeposit, fromCents, toCents } = require('../config/paymentPolicy');

const { ACTIVE_HOLD_CLAUSE, statusPlaceholders, statusParams } = require('../utils/reservationAvailability');
const { recordReservationStatusHistory } = require('../utils/reservationStatusHistory');
const { validateBooking, computePrice, findConflicts } = require('../utils/venueBooking');
const NO_RECEIPT_METHOD_TYPES = ['cash', 'card'];

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getManilaToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function createBookingReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const randomDigits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `KAB-${year}-${month}-${randomDigits}`;
}

function getDateInputError(type, body) {
  const today = getManilaToday();
  if (type === 'room') {
    if (body.event_date) return 'Rooms require check_in and check_out, not event_date.';
    if (!isValidDateString(body.check_in) || !isValidDateString(body.check_out)) return 'check_in and check_out must use the YYYY-MM-DD format.';
    if (body.check_in < today) return `check_in cannot be before today (${today}, Asia/Manila).`;
    if (body.check_out <= body.check_in) return 'check_out must be after check_in.';
    return null;
  }

  if (body.check_in || body.check_out) return 'Venues require event_date and do not accept a date range.';
  if (!isValidDateString(body.event_date)) return 'event_date must use the YYYY-MM-DD format.';
  if (body.event_date < today) return `event_date cannot be before today (${today}, Asia/Manila).`;
  return null;
}

function getNights(checkIn, checkOut) {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000);
}

function getPayment(payment) {
  if (payment === undefined || payment === null) return null;
  if (!Number.isInteger(Number(payment.payment_method_id)) || Number(payment.payment_method_id) <= 0) {
    return { error: 'payment_method_id must be a valid active payment method.' };
  }
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount < 0) return { error: 'payment amount must be a number greater than or equal to zero.' };
  if (!['deposit', 'full'].includes(payment.payment_type)) return { error: 'payment_type must be deposit or full.' };
  return { paymentMethodId: Number(payment.payment_method_id), amount, paymentType: payment.payment_type };
}

async function getAvailability(req, res) {
  const { type, check_in: checkIn, check_out: checkOut, event_date: eventDate } = req.query;
  if (!['room', 'venue'].includes(type)) return res.status(400).json({ error: 'type must be room or venue.' });

  const dateError = getDateInputError(type, { check_in: checkIn, check_out: checkOut, event_date: eventDate });
  if (dateError) return res.status(400).json({ error: dateError });

  try {
    const params = [...statusParams()];
    let items;
    if (type === 'room') {
      params.push(checkOut, checkIn);
      [items] = await pool.query(
        `SELECT r.room_id, r.room_number, r.room_type, r.capacity, r.price_per_night, r.status, r.images
         FROM Rooms r
         WHERE r.status = 'available'
           AND NOT EXISTS (
             SELECT 1 FROM Reservations res
             WHERE res.room_id = r.room_id
               AND res.status IN (${statusPlaceholders()})
               AND ${ACTIVE_HOLD_CLAUSE.replaceAll('status', 'res.status')}
               AND res.check_in_date < ?
               AND res.check_out_date > ?
           )
         ORDER BY r.price_per_night ASC`,
        params
      );
    } else {
      params.push(eventDate);
      [items] = await pool.query(
        `SELECT v.venue_id, v.venue_name, v.venue_type, v.capacity, v.status, v.images,
                v.booking_mode, v.earliest_start, v.latest_end
         FROM Venues v
         WHERE v.status = 'available'
           AND NOT EXISTS (
             SELECT 1 FROM Reservations res
             WHERE res.venue_id = v.venue_id
               AND res.status IN (${statusPlaceholders()})
               AND ${ACTIVE_HOLD_CLAUSE.replaceAll('status', 'res.status')}
               AND res.event_date = ?
           )
         ORDER BY v.venue_name ASC`,
        params
      );
    }

    return res.status(200).json({ type, ...(type === 'room' ? { check_in: checkIn, check_out: checkOut } : { event_date: eventDate }), items });
  } catch (err) {
    console.error('[getWalkInAvailability] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch walk-in availability.' });
  }
}

async function getWalkInPaymentMethods(req, res) {
  try {
    const [paymentMethods] = await pool.query(
      `SELECT payment_method_id, method_name, method_type, qr_image_url,
              account_name, account_number
       FROM PaymentMethods
       WHERE is_active = TRUE
       ORDER BY method_name ASC`
    );
    return res.status(200).json({ paymentMethods });
  } catch (err) {
    console.error('[getWalkInPaymentMethods] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch walk-in payment methods.' });
  }
}

async function createWalkInBooking(req, res, allowDeadlockRetry = true) {
  const body = req.body || {};
  const type = body.type;
  const guest = parseJsonField(body.guest, {});
  const paymentInput = parseJsonField(body.payment, undefined);
  const resourceId = Number(type === 'room' ? body.room_id : body.venue_id);
  const guestCount = Number(body.num_guests);
  const extraHours = Number(body.extra_hours || 0);
  const packageId = type === 'venue' && body.package_id ? Number(body.package_id) : null;
  const firstName = typeof guest.first_name === 'string' ? guest.first_name.trim() : '';
  const lastName = typeof guest.last_name === 'string' ? guest.last_name.trim() : '';
  const phone = typeof guest.phone_number === 'string' ? guest.phone_number.trim() : '';
  const email = typeof guest.email === 'string' ? guest.email.trim().toLowerCase() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  if (!['room', 'venue'].includes(type)) return res.status(400).json({ error: 'type must be room or venue.' });
  if (!Number.isInteger(resourceId) || resourceId <= 0) return res.status(400).json({ error: `${type}_id must be a valid ID.` });
  if (!firstName || !lastName || !phone) return res.status(400).json({ error: 'Guest first name, last name, and phone number are required.' });
  if (email.length > 100) return res.status(400).json({ error: 'Guest email must be 100 characters or fewer.' });
  if (notes.length > 1000) return res.status(400).json({ error: 'Notes must be 1000 characters or fewer.' });
  if (!Number.isInteger(guestCount) || guestCount <= 0) return res.status(400).json({ error: 'num_guests must be a whole number greater than zero.' });

  const dateError = getDateInputError(type, body);
  if (dateError) return res.status(400).json({ error: dateError });

  const payment = getPayment(paymentInput);
  if (payment?.error) return res.status(400).json({ error: payment.error });
  if (!payment) return res.status(400).json({ error: 'A payment method is required for walk-in bookings.' });

  let connection;
  let proofUrl = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const schema = await getSchemaAvailability(connection);
    if (!schema.paymentTypeAvailable) {
      await connection.rollback();
      return res.status(503).json({ error: 'Walk-in payment processing is temporarily unavailable.' });
    }

    let resource;
    if (type === 'room') {
      const [rooms] = await connection.query(
        `SELECT room_id, room_number, capacity, price_per_night, status
         FROM Rooms WHERE room_id = ? FOR UPDATE`,
        [resourceId]
      );
      if (rooms.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Room not found.' });
      }
      resource = rooms[0];
      if (resource.status !== 'available') {
        await connection.rollback();
        return res.status(409).json({ error: 'Room is not available for booking.' });
      }

      const [conflicts] = await connection.query(
        `SELECT reservation_id FROM Reservations
         WHERE room_id = ? AND status IN (${statusPlaceholders()})
           AND ${ACTIVE_HOLD_CLAUSE}
           AND check_in_date < ? AND check_out_date > ? LIMIT 1`,
        [resourceId, ...statusParams(), body.check_out, body.check_in]
      );
      if (conflicts.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'Room is already booked for part of the requested date range.' });
      }
    } else {
      const [venues] = await connection.query(
        `SELECT *
         FROM Venues WHERE venue_id = ? FOR UPDATE`,
        [resourceId]
      );
      if (venues.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Venue not found.' });
      }
      resource = venues[0];
      if (resource.status !== 'available') {
        await connection.rollback();
        return res.status(409).json({ error: 'Venue is not available for booking.' });
      }

      const [[pkg]] = packageId
        ? await connection.query('SELECT * FROM Venue_Packages WHERE package_id = ? AND venue_id = ? AND is_active = TRUE', [packageId, resourceId])
        : [[]];
      const validation = validateBooking(resource, pkg, body.event_date, body.start_time, guestCount, extraHours);
      if (!validation.valid) {
        await connection.rollback();
        return res.status(400).json({ error: validation.reason });
      }
      const conflicts = await findConflicts(connection, resourceId, body.event_date, validation.start, validation.end, Number(resource.buffer_minutes || 0), null, { forUpdate: true });
      if (conflicts.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'Venue is already booked for the selected time window.' });
      }
      resource.venueValidation = validation;
      resource.package = pkg;
    }

    if (guestCount > resource.capacity) {
      await connection.rollback();
      return res.status(400).json({ error: `Guest count cannot exceed the ${type} capacity of ${resource.capacity}.` });
    }

    const totalAmount = type === 'room'
      ? Number(resource.price_per_night) * getNights(body.check_in, body.check_out)
      : computePrice(resource, resource.package, guestCount, extraHours).total;
    const totalCents = toCents(totalAmount);
    const expectedPaymentCents = payment.paymentType === 'deposit' ? calculateDeposit(totalAmount) : totalCents;
    if (toCents(payment.amount) !== expectedPaymentCents) {
      await connection.rollback();
      return res.status(400).json({ error: `Payment amount must match the selected ${payment.paymentType} amount.` });
    }

    let paymentMethod;
    if (payment) {
      const [paymentMethods] = await connection.query(
        `SELECT payment_method_id, method_type
         FROM PaymentMethods
         WHERE payment_method_id = ? AND is_active = TRUE
         LIMIT 1`,
        [payment.paymentMethodId]
      );
      if (paymentMethods.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Selected payment method is not available.' });
      }
      paymentMethod = paymentMethods[0];
      const methodType = String(paymentMethod.method_type || '').toLowerCase();
      if (!NO_RECEIPT_METHOD_TYPES.includes(methodType) && !req.file) {
        await connection.rollback();
        return res.status(400).json({ error: 'A receipt photo is required for this payment method.' });
      }
    }

    let customerId;
    if (email) {
      const [customers] = await connection.query(
        `SELECT customer_id FROM Customer WHERE email = ? LIMIT 1 FOR UPDATE`,
        [email]
      );
      if (customers.length > 0) customerId = customers[0].customer_id;
    }

    if (customerId) {
      await connection.query(
        `UPDATE Customer SET first_name = ?, last_name = ?, phone_number = ?, is_active = TRUE WHERE customer_id = ?`,
        [firstName, lastName, phone, customerId]
      );
    } else {
      const [customerResult] = await connection.query(
        `INSERT INTO Customer (first_name, last_name, email, phone_number, password_hash, is_registered, is_active)
         VALUES (?, ?, ?, ?, NULL, FALSE, TRUE)`,
        [firstName, lastName, email || null, phone]
      );
      customerId = customerResult.insertId;
    }

    const bookingStatus = 'confirmed';
    const holdExpiresAt = null;
    const columns = type === 'room'
      ? '(customer_id, room_id, booking_source, booking_reference, hold_expires_at, check_in_date, check_out_date, num_guests, total_amount, status, created_by)'
      : '(customer_id, venue_id, booking_source, booking_reference, hold_expires_at, event_date, start_time, end_time, duration_hours, num_guests, pax, package_id, package_name, package_inclusions, unit_price, pricing_type, extra_hours, total_amount, status, created_by)';
    const values = type === 'room'
      ? [customerId, resourceId, createBookingReference(), holdExpiresAt, body.check_in, body.check_out, guestCount, totalAmount, bookingStatus, req.user.user_id]
      : [customerId, resourceId, createBookingReference(), holdExpiresAt, body.event_date, resource.venueValidation.startTime, resource.venueValidation.endTime, resource.venueValidation.durationHours, guestCount, guestCount, packageId, resource.package?.package_name || null, resource.package?.inclusions || null, computePrice(resource, resource.package, guestCount, extraHours).unit_price, computePrice(resource, resource.package, guestCount, extraHours).pricing_type, extraHours, totalAmount, bookingStatus, req.user.user_id];

    let reservationResult;
    let bookingReference;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        bookingReference = createBookingReference();
        const insertValues = [...values];
        insertValues[2] = bookingReference;
        [reservationResult] = await connection.query(
          `INSERT INTO Reservations ${columns} VALUES (?, ?, 'walk-in', ?, ?, ${type === 'room' ? '?, ?, ?, ?, ?, ?' : '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?'})`,
          insertValues
        );
        break;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY' || attempt === 4) throw err;
      }
    }
    await recordReservationStatusHistory(
      connection,
      reservationResult.insertId,
      null,
      bookingStatus,
      'staff',
      req.user.user_id
    );

    let paymentId = null;
    if (!NO_RECEIPT_METHOD_TYPES.includes(String(paymentMethod.method_type || '').toLowerCase())) {
      proofUrl = await uploadImageToCloudinary(req.file.buffer, 'kairos/payment-proofs');
    }
    const [paymentResult] = await connection.query(
      `INSERT INTO Payments
        (reservation_id, amount, payment_type, payment_method_id, proof_of_payment_url, payment_status, verified_by, verified_at)
        VALUES (?, ?, ?, ?, ?, 'verified', ?, NOW())`,
      [reservationResult.insertId, fromCents(expectedPaymentCents), payment.paymentType, payment.paymentMethodId, proofUrl, req.user.user_id]
    );
    paymentId = paymentResult.insertId;

    await logAudit({
      connection,
      userId: req.user.user_id,
      action: ACTIONS.RESERVATION_CREATE,
      entityType: ENTITY_TYPES.RESERVATION,
      entityId: reservationResult.insertId,
      newValue: {
        booking_reference: bookingReference,
        booking_source: 'walk-in',
        customer_id: customerId,
        room_id: type === 'room' ? resourceId : null,
        venue_id: type === 'venue' ? resourceId : null,
        total_amount: fromCents(totalCents),
        payment_id: paymentId,
        notes: notes || null,
      },
      ipAddress: req.ip,
    });

    await connection.commit();
    return res.status(201).json({
      message: 'Walk-in booking created successfully.',
      booking: {
        reservation_id: reservationResult.insertId,
        booking_reference: bookingReference,
        booking_source: 'walk-in',
        type,
        resource_id: resourceId,
        resource_name: type === 'room' ? resource.room_number : resource.venue_name,
        event_date: type === 'venue' ? body.event_date : null,
        check_in: type === 'room' ? body.check_in : null,
        check_out: type === 'room' ? body.check_out : null,
        num_guests: guestCount,
        total_amount: totalAmount,
        status: bookingStatus,
        payment_id: paymentId,
      },
    });
  } catch (err) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('[createWalkInBooking] Rollback error:', rollbackError.message); }
    if (proofUrl) {
      try {
        await deleteImageFromCloudinary(proofUrl);
      } catch (cleanupError) {
        console.error('[createWalkInBooking] Cloudinary cleanup error:', cleanupError.message);
      }
    }
    console.error('[createWalkInBooking] Error:', err.message);
    if (err.code === 'ER_LOCK_DEADLOCK' && allowDeadlockRetry) {
      connection.release();
      connection = null;
      return createWalkInBooking(req, res, false);
    }
    return res.status(500).json({ error: 'Failed to create walk-in booking.' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { getAvailability, getWalkInPaymentMethods, createWalkInBooking };
