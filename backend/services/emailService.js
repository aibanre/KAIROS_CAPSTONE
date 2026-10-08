require('dotenv').config();
const nodemailer = require('nodemailer');
const reservationReceiptTemplate = require('../templates/emails/reservationReceipt');
const paymentVerifiedTemplate = require('../templates/emails/paymentVerified');
const paymentRejectedTemplate = require('../templates/emails/paymentRejected');
const { generateReservationQr } = require('../utils/reservationQr');

let transporter;
let configurationWarningShown = false;
let qrConfigurationWarningShown = false;

function getTransporter() {
  if (transporter || configurationWarningShown) return transporter;

  const requiredVariables = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM_NAME', 'MAIL_FROM_EMAIL'];
  const missingVariables = requiredVariables.filter((variable) => !process.env[variable]);
  if (missingVariables.length > 0) {
    configurationWarningShown = true;
    console.warn(`[emailService] SMTP is not configured; email notifications are disabled. Missing: ${missingVariables.join(', ')}`);
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendEmail({ to, subject, html, text, attachments }, { throwOnTransportError = false } = {}) {
  if (!to) return false;

  const mailTransporter = getTransporter();
  if (!mailTransporter) return false;

  try {
    await mailTransporter.sendMail({
      from: {
        name: process.env.MAIL_FROM_NAME,
        address: process.env.MAIL_FROM_EMAIL,
      },
      to,
      subject,
      html,
      text,
      attachments,
    });
    return true;
  } catch (err) {
    console.error('[emailService] Failed to send email:', err.message);
    if (throwOnTransportError) {
      err.emailTransportRejected = true;
      throw err;
    }
    return false;
  }
}

function formatDate(value) {
  if (!value) return 'Not specified';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatAmount(value) {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getEmailData(reservation) {
  return {
    to: reservation.email,
    bookingReference: reservation.booking_reference,
    guestName: [reservation.first_name, reservation.last_name].filter(Boolean).join(' ') || 'Guest',
    resourceName: reservation.room_number || reservation.venue_name || 'Reserved room or venue',
    checkInDate: formatDate(reservation.check_in_date),
    checkOutDate: formatDate(reservation.check_out_date),
    eventDate: formatDate(reservation.event_date),
    amount: formatAmount(reservation.amount ?? reservation.total_amount),
    amountPaidNow: formatAmount(reservation.amount_paid_now ?? reservation.amount ?? 0),
    totalAmount: formatAmount(reservation.total_amount ?? reservation.total ?? 0),
    balanceDue: formatAmount(reservation.balance_due ?? 0),
    depositNotice: 'The 50% deposit confirms your reservation and is non-refundable.',
    paymentMethod: reservation.payment_method || 'Not specified',
    paymentStatus: reservation.payment_status || 'pending_verification',
    rejectionReason: reservation.rejection_reason,
  };
}

async function sendReservationReceipt(reservation) {
  try {
    return await sendEmail(reservationReceiptTemplate(getEmailData(reservation)));
  } catch (err) {
    console.error('[emailService] Failed to prepare reservation receipt:', err.message);
    return false;
  }
}

async function sendPaymentVerified(reservation) {
  let email;
  let qrAttachment;
  try {
    const data = getEmailData(reservation);
    if (reservation.status === 'confirmed' && (process.env.ADMIN_APP_URL || process.env.STAFF_PORTAL_BASE_URL)) {
      try {
        qrAttachment = await generateReservationQr(reservation.booking_reference);
      } catch (err) {
        console.error('[emailService] Failed to generate reservation QR:', err.message);
      }
    } else if (reservation.status === 'confirmed' && !qrConfigurationWarningShown) {
      qrConfigurationWarningShown = true;
      console.warn('[emailService] ADMIN_APP_URL is not configured; accepted-payment emails will omit reservation QR codes.');
    }

    const qrCid = qrAttachment ? `reservation-qr-${reservation.booking_reference}@kairos` : null;
    email = paymentVerifiedTemplate({ ...data, qrCid });
    if (qrAttachment) {
      email.attachments = [{ filename: 'reservation-qr.png', content: qrAttachment, cid: qrCid, contentType: 'image/png' }];
    }
  } catch (err) {
    console.error('[emailService] Failed to prepare payment verified email:', err.message);
    return false;
  }

  console.log(`[emailService] Sending payment-accepted email booking=${reservation.booking_reference} template=paymentVerified qr_attached=${Boolean(qrAttachment)}`);
  try {
    return await sendEmail(email, { throwOnTransportError: true });
  } catch (sendError) {
    if (!sendError.emailTransportRejected || !qrAttachment) {
      console.error('[emailService] Failed to send payment verified email:', sendError.message);
      return false;
    }

    try {
      const data = getEmailData(reservation);
      const fallbackEmail = paymentVerifiedTemplate({ ...data, qrCid: null });
      console.error('[emailService] Accepted-payment email with QR was rejected; retrying once without the QR.');
      console.log(`[emailService] Sending payment-accepted email booking=${reservation.booking_reference} template=paymentVerified qr_attached=false`);
      return await sendEmail(fallbackEmail, { throwOnTransportError: true });
    } catch (fallbackError) {
      console.error('[emailService] Failed to send payment verified email fallback:', fallbackError.message);
      return false;
    }
  }
}

async function sendPaymentRejected(reservation) {
  try {
    return await sendEmail(paymentRejectedTemplate(getEmailData(reservation)));
  } catch (err) {
    console.error('[emailService] Failed to prepare payment rejected email:', err.message);
    return false;
  }
}

module.exports = {
  sendEmail,
  sendReservationReceipt,
  sendPaymentVerified,
  sendPaymentRejected,
};