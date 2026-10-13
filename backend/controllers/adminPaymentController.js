const pool = require('../config/db');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { sendPaymentVerified, sendPaymentRejected } = require('../services/emailService');
const { getPaymentSummary, getSchemaAvailability } = require('../utils/paymentSummary');
const { toCents } = require('../config/paymentPolicy');

async function getAllPayments(req, res) {
  try {
    const { paymentTypeAvailable } = await getSchemaAvailability(pool);
    const [payments] = await pool.query(
      `SELECT p.payment_id, p.reservation_id, r.booking_reference,
              c.first_name, c.last_name,
              p.amount, ${paymentTypeAvailable ? 'p.payment_type' : "'full' AS payment_type"}, r.total_amount AS reservation_total, pm.method_name, p.payment_status,
              p.proof_of_payment_url, p.verified_at, p.verified_by,
              p.rejection_reason, p.created_at,
              r.status AS reservation_status, r.check_in_date, r.check_out_date,
              rm.room_number,
              COALESCE(u.full_name, u.username) AS verifier_name,
              u.role AS verifier_role
       FROM Payments p
       INNER JOIN Reservations r ON p.reservation_id = r.reservation_id
       LEFT JOIN Customer c ON r.customer_id = c.customer_id
       INNER JOIN PaymentMethods pm ON p.payment_method_id = pm.payment_method_id
            LEFT JOIN Rooms rm ON r.room_id = rm.room_id
            LEFT JOIN Users u ON p.verified_by = u.user_id
       ORDER BY p.created_at DESC`
    );

    const enriched = await Promise.all(payments.map(async (payment) => ({
      ...payment,
      payment_summary: await getPaymentSummary(pool, payment.reservation_id),
    })));
    return res.status(200).json({ count: enriched.length, payments: enriched });
  } catch (err) {
    console.error('[getAllPayments] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch payments.' });
  }
}

async function decidePayment(req, res, decision) {
  const paymentId = Number(req.params.id);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    return res.status(400).json({ error: 'Invalid payment ID.' });
  }
  if (decision === 'rejected' && reason.length > 255) {
    return res.status(400).json({ error: 'reason must be 255 characters or fewer.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [payments] = await connection.query(
      `SELECT payment_id, reservation_id, payment_status
       FROM Payments
       WHERE payment_id = ?
       FOR UPDATE`,
      [paymentId]
    );

    if (payments.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const payment = payments[0];
    const [reservations] = await connection.query(
      `SELECT reservation_id, status, total_amount, booking_source
       FROM Reservations
       WHERE reservation_id = ?
       FOR UPDATE`,
      [payment.reservation_id]
    );

    if (reservations.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    const reservation = reservations[0];
    if (payment.payment_status !== 'pending_verification' || reservation.status !== 'pending_verification') {
      await connection.rollback();
      return res.status(409).json({ error: 'Payment is no longer available for review.' });
    }

    if (decision === 'verified') {
      const summary = await getPaymentSummary(connection, payment.reservation_id, reservation);
      const [candidateRows] = await connection.query(
        `SELECT amount FROM Payments WHERE payment_id = ? LIMIT 1`,
        [paymentId]
      );
      if (toCents(summary.amount_paid) + toCents(candidateRows[0]?.amount) > toCents(summary.total)) {
        await connection.rollback();
        return res.status(409).json({ error: 'Payment would exceed the reservation total.' });
      }
    }

    const [emailReservations] = await connection.query(
      `SELECT r.booking_reference, r.check_in_date, r.check_out_date, r.event_date,
              r.total_amount, r.status,
              c.first_name, c.last_name, c.email,
              rm.room_number,
              v.venue_name,
              p.amount, p.rejection_reason,
              pm.method_name AS payment_method
       FROM Reservations r
       INNER JOIN Customer c ON c.customer_id = r.customer_id
       LEFT JOIN Rooms rm ON rm.room_id = r.room_id
       LEFT JOIN Venues v ON v.venue_id = r.venue_id
       INNER JOIN Payments p ON p.reservation_id = r.reservation_id
       INNER JOIN PaymentMethods pm ON pm.payment_method_id = p.payment_method_id
       WHERE p.payment_id = ?
       LIMIT 1`,
      [paymentId]
    );

    const emailReservation = emailReservations[0];

    await connection.query(
      `UPDATE Payments
       SET payment_status = ?, verified_by = ?, verified_at = NOW(), rejection_reason = ?
       WHERE payment_id = ?`,
      [decision, req.user.user_id, decision === 'rejected' ? (reason || null) : null, paymentId]
    );

    await connection.query(
      `UPDATE Reservations
       SET status = ?, hold_expires_at = NULL,
           cancellation_reason = ?
       WHERE reservation_id = ?`,
      [decision === 'verified' ? 'confirmed' : 'rejected', decision === 'rejected' ? (reason || null) : null, payment.reservation_id]
    );

    await logAudit({
      connection,
      userId: req.user.user_id,
      action: decision === 'verified' ? ACTIONS.PAYMENT_ACCEPT : ACTIONS.PAYMENT_DECLINE,
      entityType: ENTITY_TYPES.PAYMENT,
      entityId: paymentId,
      oldValue: { payment_status: payment.payment_status, reservation_status: reservation.status },
      newValue: {
        payment_status: decision,
        reservation_status: decision === 'verified' ? 'confirmed' : 'rejected',
        rejection_reason: decision === 'rejected' ? (reason || null) : null,
        reviewer: {
          user_id: req.user.user_id,
          role: req.user.role,
        },
      },
      ipAddress: req.ip,
    });

    await connection.commit();

    console.log(`[decidePayment] Payment email hook reached for ${decision}, payment ${paymentId}.`);
    console.log(`[decidePayment] Payment email recipient: ${emailReservation?.email || '(none)'}`);

    if (emailReservation) {
      emailReservation.status = decision === 'verified' ? 'confirmed' : 'rejected';
      emailReservation.rejection_reason = decision === 'rejected' ? (reason || null) : null;
      const emailSummary = await getPaymentSummary(pool, payment.reservation_id);
      emailReservation.amount_paid_now = emailReservation.amount;
      emailReservation.balance_due = emailSummary?.balance_due ?? 0;
      void (decision === 'verified'
        ? sendPaymentVerified(emailReservation)
        : sendPaymentRejected(emailReservation)).catch((err) => {
        console.error('[decidePayment] Payment email hook failed:', err.message);
      });
    }

    return res.status(200).json({
      message: decision === 'verified' ? 'Payment accepted successfully.' : 'Payment declined successfully.',
      payment_id: paymentId,
      payment_status: decision,
      reservation_status: decision === 'verified' ? 'confirmed' : 'rejected',
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('[decidePayment] Rollback error:', rollbackError.message);
    }
    console.error('[decidePayment] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update payment verification.' });
  } finally {
    connection.release();
  }
}

function acceptPayment(req, res) {
  return decidePayment(req, res, 'verified');
}

function declinePayment(req, res) {
  return decidePayment(req, res, 'rejected');
}

module.exports = { getAllPayments, acceptPayment, declinePayment };
