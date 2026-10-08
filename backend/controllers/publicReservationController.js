const pool = require('../config/db');
const { uploadImageToCloudinary } = require('../utils/cloudinaryUpload');
const { sendReservationReceipt } = require('../services/emailService');
const { calculateDeposit, fromCents, toCents } = require('../config/paymentPolicy');
const { getPaymentSummary, getSchemaAvailability } = require('../utils/paymentSummary');
const { publish } = require('../services/notificationHub');
const { recordReservationStatusHistory } = require('../utils/reservationStatusHistory');

async function getReservation(req, res) {
  try {
    // reservationAccess has already validated access; look up by reservation_id only.
    const ownershipClause = 'r.reservation_id = ?';
    const ownershipParams = [req.params.id];
    const [reservations] = await pool.query(
      `SELECT r.reservation_id, r.booking_reference, r.room_id, r.venue_id,
              r.check_in_date, r.check_out_date, r.event_date, r.num_guests,
              r.total_amount, r.status, r.hold_expires_at,
              rm.room_number, rm.room_type, rm.price_per_night, rm.images,
              v.venue_name, v.venue_type, v.images AS venue_images,
              (SELECT p.rejection_reason FROM Payments p
               WHERE p.reservation_id = r.reservation_id
               ORDER BY p.payment_id DESC LIMIT 1) AS payment_rejection_reason
       FROM Reservations r
       LEFT JOIN Rooms rm ON rm.room_id = r.room_id
       LEFT JOIN Venues v ON v.venue_id = r.venue_id
       WHERE ${ownershipClause}
       LIMIT 1`,
      ownershipParams
    );

    if (reservations.length === 0) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    const reservation = reservations[0];
    const paymentSummary = await getPaymentSummary(pool, reservation.reservation_id, reservation);

    if (req.accessMode === 'token') {
      return res.status(200).json({
        reservation: {
          reservation_id: reservation.reservation_id,
          booking_reference: reservation.booking_reference,
          room_id: reservation.room_id,
          venue_id: reservation.venue_id,
          check_in_date: reservation.check_in_date,
          check_out_date: reservation.check_out_date,
          event_date: reservation.event_date,
          num_guests: reservation.num_guests,
          total_amount: paymentSummary ? paymentSummary.total : null,
          payment_summary: paymentSummary || {},
          status: reservation.status,
          hold_expires_at: reservation.hold_expires_at,
          payment_rejection_reason: reservation.payment_rejection_reason,
        },
        room: {
          room_id: reservation.room_id,
          room_number: reservation.room_number,
          room_type: reservation.room_type,
          price_per_night: reservation.price_per_night,
          images: reservation.images,
        },
        venue: reservation.venue_id ? {
          venue_id: reservation.venue_id,
          venue_name: reservation.venue_name,
          venue_type: reservation.venue_type,
          images: reservation.venue_images,
        } : null,
      });
    }

    return res.status(200).json({
      reservation: {
        reservation_id: reservation.reservation_id,
        booking_reference: reservation.booking_reference,
        room_id: reservation.room_id,
        venue_id: reservation.venue_id,
        check_in_date: reservation.check_in_date,
        check_out_date: reservation.check_out_date,
        event_date: reservation.event_date,
        num_guests: reservation.num_guests,
        total_amount: reservation.total_amount,
        payment_summary: paymentSummary,
        status: reservation.status,
        hold_expires_at: reservation.hold_expires_at,
        payment_rejection_reason: reservation.payment_rejection_reason,
      },
      room: {
        room_id: reservation.room_id,
        room_number: reservation.room_number,
        room_type: reservation.room_type,
        price_per_night: reservation.price_per_night,
        images: reservation.images,
      },
      venue: reservation.venue_id ? {
        venue_id: reservation.venue_id,
        venue_name: reservation.venue_name,
        venue_type: reservation.venue_type,
        images: reservation.venue_images,
      } : null,
    });
  } catch (err) {
    console.error('[getReservation] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch reservation.' });
  }
}

async function submitPaymentProof(req, res) {
  const reservationId = Number(req.params.id);
  const paymentMethodId = Number(req.body.payment_method_id);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Invalid reservation ID.' });
  }
  if (!Number.isInteger(paymentMethodId) || paymentMethodId <= 0) {
    return res.status(400).json({ error: 'payment_method_id is required.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'proof_of_payment is required.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // reservationAccess has already validated access; look up by reservation_id only.
    const ownershipClause = 'reservation_id = ?';
    const ownershipParams = [reservationId];
    const [reservations] = await connection.query(
      `SELECT reservation_id, booking_reference, total_amount, status, hold_expires_at, customer_id
       FROM Reservations
       WHERE ${ownershipClause}
       FOR UPDATE`,
      ownershipParams
    );

    if (reservations.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    const reservation = reservations[0];
    if (reservation.status !== 'payment_pending') {
      await connection.rollback();
      return res.status(409).json({
        error: `Payment cannot be submitted because this reservation is ${reservation.status.replace('_', ' ')}.`,
      });
    }

    if (reservation.hold_expires_at && new Date(reservation.hold_expires_at) < new Date()) {
      await connection.rollback();
      return res.status(410).json({ error: 'Your payment hold has expired. Please start a new booking.' });
    }

    const schema = await getSchemaAvailability(connection);
    if (!schema.paymentTypeAvailable) {
      await connection.rollback();
      return res.status(503).json({ error: 'Online deposit payments are temporarily unavailable.' });
    }

    const [existingPayments] = await connection.query(
      `SELECT payment_id FROM Payments
       WHERE reservation_id = ? AND payment_status IN ('pending', 'pending_verification')
       LIMIT 1`,
      [reservationId]
    );
    if (existingPayments.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'A payment proof is already pending review.' });
    }

    const [paymentMethods] = await connection.query(
      `SELECT payment_method_id
       FROM PaymentMethods
       WHERE payment_method_id = ? AND is_active = TRUE
       LIMIT 1`,
      [paymentMethodId]
    );

    if (paymentMethods.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Selected payment method is not available.' });
    }

    const proofUrl = await uploadImageToCloudinary(req.file.buffer, 'kairos/payment-proofs');
    const depositDue = fromCents(calculateDeposit(reservation.total_amount));

    await connection.query(
      `INSERT INTO Payments
       (reservation_id, amount, payment_type, payment_method_id, proof_of_payment_url, payment_status)
       VALUES (?, ?, 'deposit', ?, ?, 'pending_verification')`,
      [reservationId, depositDue, paymentMethodId, proofUrl]
    );
    const actorType = req.accessMode === 'staff' ? 'staff' : 'customer';
    const actorId = req.accessMode === 'staff' ? req.user.user_id : reservation.customer_id;
    await recordReservationStatusHistory(connection, reservationId, 'payment_pending', 'pending_verification', actorType, actorId);

    await connection.query(
      `UPDATE Reservations
       SET status = 'pending_verification'
       WHERE reservation_id = ?`,
      [reservationId]
    );

    const [emailReservations] = await connection.query(
      `SELECT r.booking_reference, r.check_in_date, r.check_out_date, r.event_date,
              r.total_amount, r.status,
              c.first_name, c.last_name, c.email,
              rm.room_number,
              v.venue_name,
              pm.method_name AS payment_method,
              p.payment_status
       FROM Reservations r
       INNER JOIN Customer c ON c.customer_id = r.customer_id
       LEFT JOIN Rooms rm ON rm.room_id = r.room_id
       LEFT JOIN Venues v ON v.venue_id = r.venue_id
       INNER JOIN Payments p ON p.reservation_id = r.reservation_id
       INNER JOIN PaymentMethods pm ON pm.payment_method_id = p.payment_method_id
       WHERE r.reservation_id = ?
       ORDER BY p.payment_id DESC
       LIMIT 1`,
      [reservationId]
    );

    await connection.commit();

    if (emailReservations.length > 0) {
      void sendReservationReceipt({ ...emailReservations[0], amount_paid_now: depositDue, balance_due: fromCents(toCents(reservation.total_amount) - toCents(depositDue)) });
    }

    try {
      const notificationReservation = emailReservations[0];
      publish({
        type: 'payment_submitted',
        booking_reference: reservation.booking_reference,
        guest_name: notificationReservation ? `${notificationReservation.first_name} ${notificationReservation.last_name}`.trim() : 'Guest',
        resource_name: notificationReservation?.room_number || notificationReservation?.venue_name || 'Reserved resource',
        created_at: new Date().toISOString(),
      });
    } catch (notificationError) {
      console.error('[submitPaymentProof] Notification error:', notificationError.message);
    }

    const submittedSummary = await getPaymentSummary(pool, reservationId);
    return res.status(200).json({
      booking_reference: reservation.booking_reference,
      status: 'pending_verification',
      total: submittedSummary.total,
      deposit_due: submittedSummary.deposit_due,
      balance_due: fromCents(toCents(reservation.total_amount) - toCents(submittedSummary.deposit_due)),
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('[submitPaymentProof] Rollback error:', rollbackError.message);
    }
    console.error('[submitPaymentProof] Error:', err.message);
    return res.status(500).json({ error: 'Failed to submit payment proof.' });
  } finally {
    connection.release();
  }
}

module.exports = { getReservation, submitPaymentProof };
