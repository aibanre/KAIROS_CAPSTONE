const QRCode = require('qrcode');

async function generateReservationQr(bookingReference, baseUrl = process.env.ADMIN_APP_URL || process.env.STAFF_PORTAL_BASE_URL) {
  if (!baseUrl) throw new Error('ADMIN_APP_URL is not configured.');
  if (!bookingReference) throw new Error('Booking reference is required to generate a QR code.');

  const url = `${baseUrl.replace(/\/$/, '')}/admin/reservations?ref=${encodeURIComponent(bookingReference)}`;
  return QRCode.toBuffer(url, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 300,
  });
}

module.exports = { generateReservationQr };