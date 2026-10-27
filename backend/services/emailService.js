require('dotenv').config();
const nodemailer = require('nodemailer');
const reservationReceiptTemplate = require('../templates/emails/reservationReceipt');
const paymentVerifiedTemplate = require('../templates/emails/paymentVerified');
const paymentRejectedTemplate = require('../templates/emails/paymentRejected');
const { passwordReset, passwordChanged } = require('../templates/emails/passwordReset');
const verificationCodeTemplate = require('../templates/emails/verificationCode');
const { generateReservationQr } = require('../utils/reservationQr');
const { getResortLocation } = require('../utils/resortLocation');

let transporter;
let configurationWarningShown = false;
let qrConfigurationWarningShown = false;
let publicAppUrlWarningShown = false;

function getTransporter() {
  if (transporter || configurationWarningShown) return transporter;

  const requiredVariables = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM_NAME', 'MAIL_FROM_EMAIL'];
  const missingVariables = requiredVariables.filter((variable) => !process.env[variable]);
  if (missingVariables.length > 0) {
    configurationWarningShown = true;
    if (process.env.BREVO_API_KEY) {
      console.warn('[emailService] SMTP is not configured; using the Brevo HTTP API fallback.');
    } else {
      console.warn(`[emailService] SMTP is not configured; email notifications are disabled. Missing: ${missingVariables.join(', ')}`);
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    requireTLS: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendWithBrevoApi({ to, subject, html, text, attachments }) {
  const payload = {
    sender: {
      name: process.env.MAIL_FROM_NAME,
      email: process.env.MAIL_FROM_EMAIL,
    },
    to: (Array.isArray(to) ? to : [to]).map((recipient) => (
      typeof recipient === 'string' ? { email: recipient } : recipient
    )),
    subject,
    htmlContent: html,
    textContent: text,
  };
  if (attachments?.length) {
    payload.attachment = attachments.map((attachment) => {
      if (!attachment.content) throw new Error('Brevo API fallback requires in-memory email attachments.');
      return {
        name: attachment.filename || 'attachment',
        content: Buffer.isBuffer(attachment.content)
          ? attachment.content.toString('base64')
          : Buffer.from(String(attachment.content)).toString('base64'),
        ...(attachment.cid ? { contentId: attachment.cid } : {}),
      };
    });
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const errorBody = await response.json();
      detail = [errorBody.code, errorBody.message].filter(Boolean).join(': ');
    } catch (error) {
      detail = '';
    }
    throw new Error(`Brevo API rejected the email with HTTP ${response.status}${detail ? ` (${detail})` : ''}.`);
  }
}

async function sendEmail({ to, subject, html, text, attachments }, { throwOnTransportError = false } = {}) {
  if (!to) return false;

  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    if (process.env.BREVO_API_KEY) {
      try {
        await sendWithBrevoApi({ to, subject, html, text, attachments });
        return true;
      } catch (err) {
        console.error('[emailService] Brevo API fallback failed:', err.message);
        if (throwOnTransportError) {
          err.emailTransportRejected = true;
          throw err;
        }
      }
    }
    return false;
  }

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
    if (process.env.BREVO_API_KEY) {
      console.warn('[emailService] SMTP send failed; trying the Brevo HTTP API fallback.');
      try {
        await sendWithBrevoApi({ to, subject, html, text, attachments });
        return true;
      } catch (fallbackError) {
        console.error('[emailService] Brevo API fallback failed:', fallbackError.message);
        if (throwOnTransportError) {
          fallbackError.emailTransportRejected = true;
          throw fallbackError;
        }
      }
    }
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
  let mapAttachment;
  let location;
  try {
    const data = getEmailData(reservation);
    const isConfirmed = reservation.status === 'confirmed';
    if (isConfirmed) {
      location = await getResortLocation(reservation.booking_reference);
      console.log(`[emailService] Resort directions booking=${reservation.booking_reference} source=${location.directionsSource} url=${location.directionsUrl}`);
      if (location.mapImageBuffer) {
        location.mapCid = `resort-map-${reservation.booking_reference}@kairos`;
        mapAttachment = {
          filename: 'resort-map.png',
          content: location.mapImageBuffer,
          cid: location.mapCid,
          contentType: 'image/png',
        };
      }
    }
    if (isConfirmed && process.env.ADMIN_APP_URL) {
      try {
        qrAttachment = await generateReservationQr(reservation.booking_reference);
      } catch (err) {
        console.error('[emailService] Failed to generate reservation QR:', err.message);
      }
    } else if (isConfirmed && !qrConfigurationWarningShown) {
      qrConfigurationWarningShown = true;
      console.warn('[emailService] ADMIN_APP_URL is not configured; accepted-payment emails will omit reservation QR codes.');
    }

    const qrCid = qrAttachment ? `reservation-qr-${reservation.booking_reference}@kairos` : null;
    email = paymentVerifiedTemplate({ ...data, qrCid, location });
    email.attachments = [
      ...(qrAttachment ? [{
        filename: 'reservation-qr.png',
        content: qrAttachment,
        cid: qrCid,
        contentType: 'image/png',
        contentDisposition: 'inline',
      }] : []),
      ...(mapAttachment ? [mapAttachment] : []),
    ];
  } catch (err) {
    console.error('[emailService] Failed to prepare payment verified email:', err.message);
    return false;
  }

  console.log(`[emailService] Sending payment-accepted email booking=${reservation.booking_reference} template=paymentVerified qr_attached=${Boolean(qrAttachment)} map_attached=${Boolean(mapAttachment)}`);
  try {
    return await sendEmail(email, { throwOnTransportError: true });
  } catch (sendError) {
    if (!sendError.emailTransportRejected || !qrAttachment) {
      console.error('[emailService] Failed to send payment verified email:', sendError.message);
      return false;
    }

    try {
      const data = getEmailData(reservation);
      const fallbackEmail = paymentVerifiedTemplate({ ...data, qrCid: null, location });
      fallbackEmail.attachments = mapAttachment ? [mapAttachment] : [];
      console.error('[emailService] Accepted-payment email with QR was rejected; retrying once without the QR.');
      console.log(`[emailService] Sending payment-accepted email booking=${reservation.booking_reference} template=paymentVerified qr_attached=false map_attached=${Boolean(mapAttachment)}`);
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

async function sendPasswordReset(to, link) {
  if (!process.env.PUBLIC_APP_URL) {
    if (!publicAppUrlWarningShown) {
      publicAppUrlWarningShown = true;
      console.warn('[emailService] PUBLIC_APP_URL is not configured; password reset emails are disabled.');
    }
    return false;
  }

  try {
    return await sendEmail({ ...passwordReset({ link }), to });
  } catch (err) {
    console.error('[emailService] Failed to prepare password reset email:', err.message);
    return false;
  }
}

async function sendPasswordChanged(to, name) {
  try {
    return await sendEmail({ ...passwordChanged({ name }), to });
  } catch (err) {
    console.error('[emailService] Failed to prepare password changed email:', err.message);
    return false;
  }
}

async function sendVerificationCode({ to, code, purpose, firstName }) {
  const email = { ...verificationCodeTemplate({ to, code, purpose, firstName }), to };
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    if (process.env.BREVO_API_KEY) {
      try {
        return await sendEmail(email, { throwOnTransportError: true });
      } catch (err) {
        console.error('[emailService] Failed to send verification code through Brevo API:', err.message);
        const error = new Error('Verification email service is unavailable.');
        error.statusCode = 503;
        throw error;
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[emailService] Verification code for ${purpose} ${to}: ${code}`);
      return true;
    }
    const error = new Error('Verification email service is unavailable.');
    error.statusCode = 503;
    throw error;
  }

  try {
    return await sendEmail(email, { throwOnTransportError: true });
  } catch (err) {
    console.error('[emailService] Failed to send verification code:', err.message);
    const error = new Error('Verification email service is unavailable.');
    error.statusCode = 503;
    throw error;
  }
}

module.exports = {
  sendEmail,
  sendReservationReceipt,
  sendPaymentVerified,
  sendPaymentRejected,
  sendPasswordReset,
  sendPasswordChanged,
  sendVerificationCode,
};