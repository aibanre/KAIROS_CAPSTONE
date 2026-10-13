const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { generateReservationQr } = require('../utils/reservationQr');

function customerId(req) { return Number(req.user.user_id); }

async function getCheckinQr(reservation) {
  if (reservation.status !== 'confirmed') return null;

  try {
    const qr = await generateReservationQr(reservation.booking_reference);
    return `data:image/png;base64,${qr.toString('base64')}`;
  } catch (err) {
    console.error('[customerController] Failed to generate reservation QR:', err.message);
    return null;
  }
}

async function listReservations(req, res) {
  try {
    const [reservations] = await pool.query(
      `SELECT r.reservation_id, r.customer_id, r.room_id, r.venue_id, r.booking_source,
              r.booking_reference, r.created_by, r.hold_expires_at,
              r.check_in_date, r.check_out_date,
              DATE_FORMAT(r.event_date, '%Y-%m-%d') AS event_date,
              TIME_FORMAT(r.start_time, '%H:%i:%s') AS start_time,
              TIME_FORMAT(r.end_time, '%H:%i:%s') AS end_time,
              r.duration_hours, r.pax, r.package_id, r.num_guests, r.children, r.total_amount,
              r.status, r.cancellation_reason, r.created_at, r.updated_at,
              r.actual_check_in, r.actual_check_out, r.early_checkin_fee,
              r.late_checkout_fee, r.fees_collected_at, r.package_name,
              r.package_inclusions, r.pricing_type, r.unit_price, r.extra_hours,
              rm.room_number, rm.room_type, rm.images, v.venue_name,
              (SELECT p.payment_status FROM Payments p WHERE p.reservation_id=r.reservation_id ORDER BY p.payment_id DESC LIMIT 1) payment_status,
              (SELECT p.rejection_reason FROM Payments p WHERE p.reservation_id=r.reservation_id ORDER BY p.payment_id DESC LIMIT 1) payment_rejection_reason,
              (SELECT COUNT(*) FROM Reviews rv WHERE rv.reservation_id=r.reservation_id) reviewed
       FROM Reservations r LEFT JOIN Rooms rm ON rm.room_id=r.room_id
       LEFT JOIN Venues v ON v.venue_id=r.venue_id WHERE r.customer_id=? ORDER BY r.created_at DESC`,
      [customerId(req)]
    );
    const reservationsWithQr = await Promise.all(
      reservations.map(async (reservation) => ({
        ...reservation,
        checkin_qr: await getCheckinQr(reservation),
      }))
    );
    return res.json({ reservations: reservationsWithQr, server_time: new Date().toISOString() });
  } catch (err) { console.error('[listReservations]', err.message); return res.status(500).json({ error: 'Failed to fetch reservations.' }); }
}

async function reservationDetails(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT r.reservation_id, r.customer_id, r.room_id, r.venue_id, r.booking_source,
       r.booking_reference, r.created_by, r.hold_expires_at, r.check_in_date,
       r.check_out_date, DATE_FORMAT(r.event_date, '%Y-%m-%d') AS event_date,
       TIME_FORMAT(r.start_time, '%H:%i:%s') AS start_time,
       TIME_FORMAT(r.end_time, '%H:%i:%s') AS end_time, r.duration_hours, r.pax,
       r.package_id, r.num_guests, r.children, r.total_amount, r.status, r.cancellation_reason,
       r.created_at, r.updated_at, r.actual_check_in, r.actual_check_out,
       r.early_checkin_fee, r.late_checkout_fee, r.fees_collected_at,
       r.package_name, r.package_inclusions, r.pricing_type, r.unit_price,
       r.extra_hours, rm.room_number, rm.room_type, rm.images, v.venue_name
       FROM Reservations r LEFT JOIN Rooms rm ON rm.room_id=r.room_id LEFT JOIN Venues v ON v.venue_id=r.venue_id
       WHERE r.reservation_id=? AND r.customer_id=?`, [req.params.id, customerId(req)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Reservation not found.' });
    const [payments] = await pool.query('SELECT payment_id, amount, payment_type, payment_status, created_at FROM Payments WHERE reservation_id=? ORDER BY created_at DESC', [req.params.id]);
    const [timeline] = await pool.query('SELECT history_id, from_status, to_status, change_source, reason, created_at FROM Reservation_Status_History WHERE reservation_id=? ORDER BY created_at ASC', [req.params.id]);
    return res.json({ reservation: { ...rows[0], checkin_qr: await getCheckinQr(rows[0]), server_time: new Date().toISOString() }, payments, timeline, server_time: new Date().toISOString() });
  } catch (err) { console.error('[reservationDetails]', err.message); return res.status(500).json({ error: 'Failed to fetch reservation.' }); }
}

async function paymentHistory(req, res) {
  try {
    const [payments] = await pool.query(
      `SELECT p.*, r.booking_reference FROM Payments p INNER JOIN Reservations r ON r.reservation_id=p.reservation_id
       WHERE r.customer_id=? ORDER BY p.created_at DESC`, [customerId(req)]
    );
    return res.json({ payments });
  } catch (err) { return res.status(500).json({ error: 'Failed to fetch payment history.' }); }
}

async function profile(req, res) {
  try {
    const [rows] = await pool.query('SELECT customer_id AS user_id, first_name, last_name, email, phone_number, address FROM Customer WHERE customer_id=? AND is_registered=TRUE', [customerId(req)]);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found.' });
    return res.json({ customer: rows[0] });
  } catch (err) { return res.status(500).json({ error: 'Failed to fetch profile.' }); }
}

async function updateProfile(req, res) {
  const { first_name, last_name, email, phone_number, address } = req.body;
  if (![first_name, last_name, phone_number].every((v) => typeof v === 'string' && v.trim())) return res.status(400).json({ error: 'First name, last name, and phone number are required.' });
  if (email !== undefined && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) return res.status(400).json({ error: 'A valid email address is required.' });
  try {
    const normalizedEmail = email?.trim().toLowerCase();
    if (normalizedEmail) {
      const [duplicates] = await pool.query('SELECT customer_id FROM Customer WHERE email=? AND customer_id<>? LIMIT 1', [normalizedEmail, customerId(req)]);
      if (duplicates.length) return res.status(409).json({ error: 'That email address is already in use.' });
    }
    await pool.query('UPDATE Customer SET first_name=?, last_name=?, email=COALESCE(?, email), phone_number=?, address=? WHERE customer_id=?', [first_name.trim(), last_name.trim(), normalizedEmail || null, phone_number.trim(), address?.trim() || null, customerId(req)]);
    return profile(req, res);
  } catch (err) { return res.status(500).json({ error: 'Failed to update profile.' }); }
}

async function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  if (typeof new_password !== 'string' || new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  try {
    const [rows] = await pool.query('SELECT password_hash FROM Customer WHERE customer_id=?', [customerId(req)]);
    if (!rows.length || !(await bcrypt.compare(current_password || '', rows[0].password_hash || ''))) return res.status(400).json({ error: 'Current password is incorrect.' });
    await pool.query('UPDATE Customer SET password_hash=? WHERE customer_id=?', [await bcrypt.hash(new_password, 12), customerId(req)]);
    return res.json({ message: 'Password updated successfully.' });
  } catch (err) { return res.status(500).json({ error: 'Failed to update password.' }); }
}

async function listReviews(req, res) {
  const rawLimit = req.query.limit;
  const parsedLimit = Number(rawLimit);
  const limit = rawLimit !== undefined && Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 50
    ? parsedLimit
    : null;
  const random = req.query.random === '1';
  const roomId = req.query.room_id;
  const venueId = req.query.venue_id;
  const validRoomId = roomId === undefined || (/^\d+$/.test(String(roomId)) && Number(roomId) > 0);
  const validVenueId = venueId === undefined || (/^\d+$/.test(String(venueId)) && Number(venueId) > 0);

  if (!validRoomId || !validVenueId || (roomId !== undefined && venueId !== undefined)) {
    return res.json({ reviews: [] });
  }

  const conditions = ["r.status='completed'"];
  const params = [];
  if (roomId !== undefined) {
    conditions.push('r.room_id=?');
    params.push(Number(roomId));
  }
  if (venueId !== undefined) {
    conditions.push('r.venue_id=?');
    params.push(Number(venueId));
  }

  const orderBy = random ? 'RAND()' : 'rv.created_at DESC';
  const limitClause = limit ? ' LIMIT ?' : '';
  if (limit) params.push(limit);

  try {
    const [reviews] = await pool.query(
      `SELECT rv.review_id, rv.reservation_id, rv.rating, rv.comment, rv.created_at,
              c.first_name, c.last_name, r.room_id, r.venue_id,
              CASE WHEN r.room_id IS NOT NULL THEN rm.room_number ELSE v.venue_name END AS resource_name,
              CASE WHEN r.room_id IS NOT NULL THEN 'room' ELSE 'venue' END AS resource_type
       FROM Reviews rv
       INNER JOIN Customer c ON c.customer_id=rv.customer_id
       INNER JOIN Reservations r ON r.reservation_id=rv.reservation_id
       LEFT JOIN Rooms rm ON rm.room_id=r.room_id
       LEFT JOIN Venues v ON v.venue_id=r.venue_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}${limitClause}`,
      params
    );
    if (random) res.set('Cache-Control', 'no-store');
    return res.json({ reviews });
  } catch (err) {
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_TABLEACCESS_DENIED_ERROR'].includes(err?.code)
      || [1051, 1054, 1146].includes(err?.errno)) {
      return res.json({ reviews: [] });
    }
    console.error('[listReviews]', err.message);
    return res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
}

async function listCustomerReviews(req, res) {
  try {
    const [reviews] = await pool.query(
      `SELECT rv.*, c.first_name, c.last_name, r.room_id, r.venue_id
       FROM Reviews rv
       INNER JOIN Customer c ON c.customer_id=rv.customer_id
       INNER JOIN Reservations r ON r.reservation_id=rv.reservation_id
       WHERE rv.customer_id=? AND r.status='completed'
       ORDER BY rv.created_at DESC`,
      [customerId(req)]
    );
    return res.json({ reviews });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch your reviews.' });
  }
}

async function submitReview(req, res) {
  const reservationId = Number(req.body.reservation_id); const rating = Number(req.body.rating);
  if (!Number.isInteger(reservationId) || rating < 1 || rating > 5) return res.status(400).json({ error: 'reservation_id and rating from 1 to 5 are required.' });
  try {
    const [rows] = await pool.query("SELECT reservation_id FROM Reservations WHERE reservation_id=? AND customer_id=? AND status='completed'", [reservationId, customerId(req)]);
    if (!rows.length) return res.status(403).json({ error: 'Only completed reservations may be reviewed.' });
    await pool.query('INSERT INTO Reviews (reservation_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)', [reservationId, customerId(req), rating, req.body.comment?.trim() || null]);
    return res.status(201).json({ message: 'Review submitted successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A review has already been submitted for this reservation.' });
    return res.status(500).json({ error: 'Failed to submit review.' });
  }
}

module.exports = { listReservations, reservationDetails, paymentHistory, profile, updateProfile, changePassword, listReviews, listCustomerReviews, submitReview };
