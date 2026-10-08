const pool = require('../config/db');
const { uploadImageToCloudinary, deleteImageFromCloudinary } = require('../utils/cloudinaryUpload');
const { EXTRA_BED_PRICE, MAX_EXTRA_BEDS_PER_REQUEST, MAX_EXTRA_BEDS_PER_ROOM, NO_RECEIPT_METHOD_TYPES, fromCents, toCents } = require('../config/paymentPolicy');
const { getPaymentSummary, getSchemaAvailability } = require('../utils/paymentSummary');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { recordReservationStatusHistory } = require('../utils/reservationStatusHistory');
const {
  CLOCK_DRIFT_TOLERANCE_MINUTES,
  calculateAttendanceFee,
  formatManilaDateTime,
  parseDatabaseDateTime,
  parseLocalDateTime,
  STANDARD_CHECK_IN_HOUR,
  STANDARD_CHECK_OUT_HOUR,
  validateCheckInWindow,
} = require('../config/reservationAttendance');

async function getDisplayReservations(executor, condition = '', params = []) {
  const [reservations] = await executor.query(
    `SELECT r.reservation_id, r.booking_reference,
            DATE_FORMAT(r.check_in_date, '%Y-%m-%d') AS check_in_date,
            DATE_FORMAT(r.check_out_date, '%Y-%m-%d') AS check_out_date,
            DATE_FORMAT(r.event_date, '%Y-%m-%d') AS event_date,
            r.status AS reservation_status, r.total_amount, r.room_id, r.venue_id,
            r.actual_check_in, r.actual_check_out,
            r.early_checkin_fee, r.late_checkout_fee, r.fees_collected_at,
            c.first_name, c.last_name,
            rm.room_number, rm.room_type,
            v.venue_name, v.venue_type,
            (SELECT p.payment_status
             FROM Payments p
             WHERE p.reservation_id = r.reservation_id
             ORDER BY p.created_at DESC
             LIMIT 1) AS payment_status
     FROM Reservations r
     LEFT JOIN Customer c ON r.customer_id = c.customer_id
     LEFT JOIN Rooms rm ON r.room_id = rm.room_id
     LEFT JOIN Venues v ON r.venue_id = v.venue_id
     ${condition}
     ORDER BY r.created_at DESC`,
    params
  );
  return Promise.all(reservations.map(async (reservation) => ({
    ...reservation,
    payment_summary: await getPaymentSummary(executor, reservation.reservation_id, reservation),
  })));
}

async function getAllReservations(req, res) {
  try {
    const reservations = await getDisplayReservations(pool);
    return res.status(200).json({ count: reservations.length, reservations });
  } catch (err) {
    console.error('[getAllReservations] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch reservations.' });
  }
}

async function lookupReservation(req, res) {
  const reference = String(req.query.ref || '');
  if (!/^KAB-\d{4}-\d{2}-\d{4}$/.test(reference)) {
    return res.status(400).json({ error: 'Invalid booking reference.' });
  }

  try {
    const reservations = await getDisplayReservations(pool, 'WHERE r.booking_reference = ?', [reference]);
    if (reservations.length === 0) return res.status(404).json({ error: 'Reservation not found.' });
    return res.status(200).json({ reservation: reservations[0] });
  } catch (err) {
    console.error('[lookupReservation] Error:', err.message);
    return res.status(500).json({ error: 'Failed to lookup reservation.' });
  }
}

function getReservationId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getActualTime(body) {
  const actualTime = body?.actual_time || formatManilaDateTime().replace(' ', 'T').slice(0, 16);
  const parsed = parseLocalDateTime(actualTime);
  if (!parsed) return { error: 'actual_time must be a valid Manila time in YYYY-MM-DDTHH:mm format.' };
  if (parsed.date.getTime() > Date.now() + CLOCK_DRIFT_TOLERANCE_MINUTES * 60000) {
    return { error: 'actual_time cannot be more than 5 minutes in the future.' };
  }
  return { parsed };
}

function reservationDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function findReservation(executor, reservationId) {
  const [rows] = await executor.query(
    `SELECT r.reservation_id, r.booking_reference, r.customer_id, r.room_id, r.venue_id,
            DATE_FORMAT(r.check_in_date, '%Y-%m-%d') AS check_in_date,
            DATE_FORMAT(r.check_out_date, '%Y-%m-%d') AS check_out_date,
            DATE_FORMAT(r.event_date, '%Y-%m-%d') AS event_date,
            r.status, r.booking_source, r.total_amount,
            DATE_FORMAT(r.actual_check_in, '%Y-%m-%d %H:%i:%s') AS actual_check_in,
            DATE_FORMAT(r.actual_check_out, '%Y-%m-%d %H:%i:%s') AS actual_check_out,
            r.early_checkin_fee, r.late_checkout_fee, r.fees_collected_at,
            c.first_name, c.last_name, rm.room_number,
            (SELECT p.payment_status
             FROM Payments p
             WHERE p.reservation_id = r.reservation_id
             ORDER BY p.created_at DESC
             LIMIT 1) AS payment_status
     FROM Reservations r
     LEFT JOIN Customer c ON r.customer_id = c.customer_id
     LEFT JOIN Rooms rm ON r.room_id = rm.room_id
     WHERE r.reservation_id = ?
    ${executor === pool ? '' : 'FOR UPDATE'}`,
    [reservationId]
  );
  return rows[0] || null;
}

async function getInventoryInspectionStatus(executor, reservationId) {
  try {
    const [rows] = await executor.query(
      `SELECT check_id, total_charge_cents, charges_collected_at
       FROM Reservation_Inventory_Checks
       WHERE reservation_id = ?`,
      [reservationId]
    );
    return rows[0] || null;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146 || error.code === 'ER_BAD_FIELD_ERROR' || error.errno === 1054) return 0;
    throw error;
  }
}

function validateAttendance(action, reservation, actual, summary) {
  if (!reservation) return { status: 404, error: 'Reservation not found.' };
  if (!reservation.room_id || reservation.venue_id) return { status: 409, error: 'Attendance actions apply only to room reservations.' };
  if (action === 'check-in') {
    if (reservation.status !== 'confirmed') return { status: 409, error: 'Check-in is only available for confirmed reservations.' };
    if (!summary || summary.amount_paid < summary.deposit_due) return { status: 409, error: 'Check-in requires a verified deposit.' };
    const checkInWindow = validateCheckInWindow(actual, reservation);
    if (checkInWindow.error) return checkInWindow;
    return null;
  } else {
    if (reservation.status !== 'checked_in') return { status: 409, error: 'Check-out is only available for checked-in reservations.' };
    if (summary.balance_due > 0) return { status: 409, error: 'Balance must be settled before check-out.' };
    if (reservationDate(reservation.check_out_date) > actual.datePart) return { status: 400, error: 'Check-out actual date cannot be before the planned check-out date.' };
    const actualCheckIn = parseDatabaseDateTime(reservation.actual_check_in);
    if (!actualCheckIn || actual.date.getTime() < actualCheckIn.date.getTime()) return { status: 400, error: 'Check-out actual time cannot be before actual check-in.' };
  }

  return null;
}

function attendanceResponse(reservation, action, actual, calculation) {
  return {
    reservation_id: reservation.reservation_id,
    booking_reference: reservation.booking_reference,
    reservation_status: action === 'check-in' ? 'checked_in' : 'completed',
    actual_check_in: action === 'check-in' ? actual.value.replace('T', ' ') : reservation.actual_check_in,
    actual_check_out: action === 'check-out' ? actual.value.replace('T', ' ') : reservation.actual_check_out,
    early_checkin_fee: action === 'check-in' ? calculation.fee : reservation.early_checkin_fee,
    late_checkout_fee: action === 'check-out' ? calculation.fee : reservation.late_checkout_fee,
  };
}

async function previewAttendance(req, res) {
  const reservationId = getReservationId(req);
  const action = req.query.action;
  if (!reservationId) return res.status(400).json({ error: 'Invalid reservation ID.' });
  if (!['check-in', 'check-out'].includes(action)) return res.status(400).json({ error: 'action must be check-in or check-out.' });
  const actualResult = getActualTime(req.query);
  if (actualResult.error) return res.status(400).json({ error: actualResult.error });

  try {
    const reservation = await findReservation(pool, reservationId);
    const summary = await getPaymentSummary(pool, reservationId, reservation);
    const validationError = validateAttendance(action, reservation, actualResult.parsed, summary);
    if (validationError) return res.status(validationError.status).json({ error: validationError.error });
    const calculation = calculateAttendanceFee(action, actualResult.parsed, reservation);
    return res.status(200).json({
      action,
      actual_time: actualResult.parsed.value,
      standard_time: `${action === 'check-in' ? STANDARD_CHECK_IN_HOUR : STANDARD_CHECK_OUT_HOUR}:00`,
      ...calculation,
      ...summary,
    });
  } catch (err) {
    console.error('[previewAttendance] Error:', err.message);
    return res.status(500).json({ error: 'Failed to calculate attendance fee.' });
  }
}

async function recordAttendance(req, res, action) {
  const reservationId = getReservationId(req);
  if (!reservationId) return res.status(400).json({ error: 'Invalid reservation ID.' });
  const actualResult = getActualTime(req.body || {});
  if (actualResult.error) return res.status(400).json({ error: actualResult.error });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const reservation = await findReservation(connection, reservationId);
    const summary = await getPaymentSummary(connection, reservationId, reservation);
    const validationError = validateAttendance(action, reservation, actualResult.parsed, summary);
    if (validationError) {
      await connection.rollback();
      return res.status(validationError.status).json({ error: validationError.error });
    }
    if (action === 'check-out') {
      const inspection = await getInventoryInspectionStatus(connection, reservationId);
      if (!inspection) {
        await connection.rollback();
        return res.status(409).json({ error: 'A completed room inspection is required before check-out.' });
      }
      if (Number(inspection.total_charge_cents) > 0 && !inspection.charges_collected_at) {
        await connection.rollback();
        return res.status(409).json({ error: 'Room inspection charges must be collected before check-out.', amount_cents: Number(inspection.total_charge_cents) });
      }
    }
    const calculation = calculateAttendanceFee(action, actualResult.parsed, reservation);
    if (calculation.fee > 0 && req.body?.fee_collected !== true) {
      await connection.rollback();
      return res.status(400).json({ error: 'fee_collected must be true when an attendance fee is charged.' });
    }
    const feesCollectedAt = calculation.fee > 0 ? formatManilaDateTime() : reservation.fees_collected_at;
    const timestampColumn = action === 'check-in' ? 'actual_check_in' : 'actual_check_out';
    const feeColumn = action === 'check-in' ? 'early_checkin_fee' : 'late_checkout_fee';
    const nextStatus = action === 'check-in' ? 'checked_in' : 'completed';
    await connection.query(
      `UPDATE Reservations
       SET ${timestampColumn} = ?, ${feeColumn} = ?, fees_collected_at = ?, status = ?
       WHERE reservation_id = ?`,
      [actualResult.parsed.value.replace('T', ' '), calculation.fee, feesCollectedAt, nextStatus, reservationId]
    );
    await recordReservationStatusHistory(connection, reservationId, reservation.status, nextStatus, 'staff', req.user.user_id);
    const lateCheckIn = action === 'check-in'
      ? validateCheckInWindow(actualResult.parsed, reservation)
      : null;
    await logAudit({
      connection,
      userId: req.user.user_id,
      action: action === 'check-in' ? ACTIONS.RESERVATION_CHECK_IN : ACTIONS.RESERVATION_CHECK_OUT,
      entityType: ENTITY_TYPES.RESERVATION,
      entityId: reservationId,
      oldValue: { status: reservation.status },
      newValue: {
        status: nextStatus,
        actual_time: actualResult.parsed.value,
        fee: calculation.fee,
        hours_charged: calculation.hoursCharged,
        ...(lateCheckIn?.isLate ? { late_arrival: true, days_late: lateCheckIn.daysLate } : {}),
      },
      ipAddress: req.ip,
    });
    await connection.commit();
    return res.status(200).json({
      message: action === 'check-in' ? 'Check-in recorded successfully.' : 'Check-out recorded successfully.',
      fee: calculation.fee,
      hours_charged: calculation.hoursCharged,
      reservation: attendanceResponse(reservation, action, actualResult.parsed, calculation),
      payment_summary: await getPaymentSummary(connection, reservationId),
    });
  } catch (err) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('[recordAttendance] Rollback error:', rollbackError.message); }
    console.error('[recordAttendance] Error:', err.message);
    return res.status(500).json({ error: 'Failed to record attendance.' });
  } finally {
    connection.release();
  }
}

function checkInReservation(req, res) { return recordAttendance(req, res, 'check-in'); }
function checkOutReservation(req, res) { return recordAttendance(req, res, 'check-out'); }

function parsePaymentField(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return undefined; }
}

async function collectBalance(req, res) {
  const reservationId = getReservationId(req);
  if (!reservationId) return res.status(400).json({ error: 'Invalid reservation ID.' });
  const payment = parsePaymentField(req.body?.payment) || req.body || {};
  const paymentMethodId = Number(payment.payment_method_id);
  const amount = Number(payment.amount);
  if (!Number.isInteger(paymentMethodId) || paymentMethodId <= 0 || !Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'A valid payment method and amount are required.' });
  }

  const connection = await pool.getConnection();
  let proofUrl = null;
  try {
    await connection.beginTransaction();
    const schema = await getSchemaAvailability(connection);
    if (!schema.paymentTypeAvailable) {
      await connection.rollback();
      return res.status(503).json({ error: 'Balance collection is temporarily unavailable.' });
    }
    const reservation = await findReservation(connection, reservationId);
    if (!reservation) { await connection.rollback(); return res.status(404).json({ error: 'Reservation not found.' }); }
    if (!['confirmed', 'checked_in'].includes(reservation.status)) {
      await connection.rollback();
      return res.status(409).json({ error: 'Balance can only be collected for confirmed or checked-in reservations.' });
    }
    const summary = await getPaymentSummary(connection, reservationId, reservation);
    if (summary.amount_paid < summary.deposit_due) {
      await connection.rollback();
      return res.status(409).json({ error: 'A verified deposit is required before collecting the balance.' });
    }
    if (summary.balance_due <= 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'The reservation balance is already settled.' });
    }
    if (toCents(amount) !== toCents(summary.balance_due)) {
      await connection.rollback();
      return res.status(409).json({ error: 'Payment amount must equal the outstanding balance exactly.' });
    }
    const [methods] = await connection.query(
      `SELECT payment_method_id, method_type FROM PaymentMethods WHERE payment_method_id = ? AND is_active = TRUE LIMIT 1`,
      [paymentMethodId]
    );
    if (methods.length === 0) { await connection.rollback(); return res.status(400).json({ error: 'Selected payment method is not available.' }); }
    const methodType = String(methods[0].method_type || '').toLowerCase();
    if (!NO_RECEIPT_METHOD_TYPES.includes(methodType) && !req.file) {
      await connection.rollback();
      return res.status(400).json({ error: 'A receipt photo is required for this payment method.' });
    }
    if (req.file) proofUrl = await uploadImageToCloudinary(req.file.buffer, 'kairos/payment-proofs');
    await connection.query(
      `INSERT INTO Payments (reservation_id, amount, payment_type, payment_method_id, proof_of_payment_url, payment_status, verified_by, verified_at)
       VALUES (?, ?, 'balance', ?, ?, 'verified', ?, NOW())`,
      [reservationId, fromCents(toCents(amount)), paymentMethodId, proofUrl, req.user.user_id]
    );
    await logAudit({
      connection, userId: req.user.user_id, action: ACTIONS.BALANCE_COLLECT, entityType: ENTITY_TYPES.RESERVATION,
      entityId: reservationId, oldValue: summary, newValue: { booking_reference: reservation.booking_reference, amount: fromCents(toCents(amount)), collector: { user_id: req.user.user_id, role: req.user.role } }, ipAddress: req.ip,
    });
    await connection.commit();
    return res.status(200).json({ message: 'Balance collected successfully.', payment_summary: await getPaymentSummary(pool, reservationId) });
  } catch (err) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('[collectBalance] Rollback error:', rollbackError.message); }
    if (proofUrl) { try { await deleteImageFromCloudinary(proofUrl); } catch (cleanupError) { console.error('[collectBalance] Cleanup error:', cleanupError.message); } }
    console.error('[collectBalance] Error:', err.message);
    return res.status(500).json({ error: 'Failed to collect balance.' });
  } finally { connection.release(); }
}

async function addExtraBed(req, res, allowDeadlockRetry = true) {
  const reservationId = getReservationId(req);
  const quantity = Number(req.body?.quantity);
  if (!reservationId || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_EXTRA_BEDS_PER_REQUEST) {
    return res.status(400).json({ error: `quantity must be a positive integer up to ${MAX_EXTRA_BEDS_PER_REQUEST}.` });
  }
  let connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const schema = await getSchemaAvailability(connection);
    if (!schema.addonsAvailable || !schema.maxBedsAvailable) {
      await connection.rollback();
      return res.status(503).json({ error: 'Extra beds are temporarily unavailable.' });
    }
    const [reservationRows] = await connection.query(
      'SELECT room_id FROM Reservations WHERE reservation_id = ?',
      [reservationId]
    );
    if (reservationRows.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Reservation not found.' }); }
    if (!reservationRows[0].room_id) {
      await connection.rollback();
      return res.status(409).json({ error: 'Extra beds can only be added to confirmed or checked-in room reservations.' });
    }
    const [rooms] = await connection.query(`SELECT max_extra_beds FROM Rooms WHERE room_id = ? FOR UPDATE`, [reservationRows[0].room_id]);
    const reservation = await findReservation(connection, reservationId);
    if (!reservation || !['confirmed', 'checked_in'].includes(reservation.status)) {
      await connection.rollback();
      return res.status(409).json({ error: 'Extra beds can only be added to confirmed or checked-in room reservations.' });
    }
    const cap = Number(rooms[0]?.max_extra_beds || 0);
    const summary = await getPaymentSummary(connection, reservationId, reservation);
    if (summary.beds_added + quantity > Math.min(cap, MAX_EXTRA_BEDS_PER_ROOM)) {
      await connection.rollback();
      return res.status(409).json({ error: 'The requested beds exceed the room cap.' });
    }
    await connection.query(
      `INSERT INTO Reservation_Addons (reservation_id, addon_type, quantity, unit_price, added_by) VALUES (?, 'extra_bed', ?, ?, ?)`,
      [reservationId, quantity, EXTRA_BED_PRICE, req.user.user_id]
    );
    await logAudit({
      connection, userId: req.user.user_id, action: ACTIONS.RESERVATION_ADDON, entityType: ENTITY_TYPES.RESERVATION,
      entityId: reservationId, oldValue: summary, newValue: { booking_reference: reservation.booking_reference, addon_type: 'extra_bed', quantity, unit_price: EXTRA_BED_PRICE, actor: { user_id: req.user.user_id, role: req.user.role } }, ipAddress: req.ip,
    });
    await connection.commit();
    const updatedSummary = await getPaymentSummary(pool, reservationId);
    return res.status(200).json({ message: 'Extra bed added successfully.', payment_summary: { ...updatedSummary, remaining_cap: Math.min(cap, MAX_EXTRA_BEDS_PER_ROOM) - updatedSummary.beds_added } });
  } catch (err) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('[addExtraBed] Rollback error:', rollbackError.message); }
    console.error('[addExtraBed] Error:', err.message);
    if (err.code === 'ER_LOCK_DEADLOCK' && allowDeadlockRetry) {
      connection.release();
      connection = null;
      return addExtraBed(req, res, false);
    }
    return res.status(500).json({ error: 'Failed to add extra bed.' });
  } finally { if (connection) connection.release(); }
}

module.exports = { getAllReservations, lookupReservation, previewAttendance, checkInReservation, checkOutReservation, collectBalance, addExtraBed };