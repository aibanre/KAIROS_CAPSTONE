const { escapeHtml, renderEmail } = require('./templateUtils');

const BRAND = '#0b6174';
const BRAND_LIGHT = '#eef6f8';
const BORDER = '#d9e2ec';
const TEXT = '#1f2933';
const MUTED = '#52606d';
const FONT = 'Arial, Helvetica, sans-serif';

const safe = (value) => escapeHtml(String(value ?? ''));

// Turns Date objects, ISO strings, or "Sat Oct 17 2026 00:00:00 GMT+0800 (...)" strings
// into "Saturday, October 17, 2026" in Asia/Manila time.
function formatDate(value) {
  if (!value || value === 'Not specified') return String(value || '');
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(date);
}

const dateCell = (label, date, note, width) => `
  <td width="${width}" valign="top" style="padding:14px 16px;background:${BRAND_LIGHT};border-radius:6px;">
    <div style="font-family:${FONT};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${safe(label)}</div>
    <div style="font-family:${FONT};font-size:15px;font-weight:bold;color:${TEXT};padding-top:4px;">${safe(date)}</div>
    ${note ? `<div style="font-family:${FONT};font-size:13px;color:${MUTED};padding-top:2px;">${safe(note)}</div>` : ''}
  </td>`;

const moneyRow = (label, value, { bold = false, color = TEXT, last = false } = {}) => `
  <tr>
    <td style="padding:10px 0;${last ? '' : `border-bottom:1px solid ${BORDER};`}font-family:${FONT};font-size:14px;color:${MUTED};">${safe(label)}</td>
    <td align="right" style="padding:10px 0;${last ? '' : `border-bottom:1px solid ${BORDER};`}font-family:${FONT};font-size:14px;font-weight:${bold ? 'bold' : 'normal'};color:${color};">${safe(value)}</td>
  </tr>`;

module.exports = function paymentVerified(data) {
  const location = data.location;
  const isVenue = data.eventDate !== 'Not specified';
  const checkIn = formatDate(data.checkInDate);
  const checkOut = formatDate(data.checkOutDate);
  const eventDate = formatDate(data.eventDate);

  const stayBlock = isVenue
    ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
        ${dateCell('Event date', eventDate, '', '100%')}
      </tr></table>`
    : `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
        ${dateCell('Check-in', checkIn, 'From 2:00 PM', '48%')}
        <td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>
        ${dateCell('Check-out', checkOut, 'Until 12:00 noon', '48%')}
      </tr></table>`;

  const referenceBlock = `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
      <td align="center" style="padding:18px 16px;border:2px dashed ${BRAND};border-radius:8px;">
        <div style="font-family:${FONT};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Booking reference</div>
        <div style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:bold;letter-spacing:1px;color:${BRAND};padding-top:6px;">${safe(data.bookingReference)}</div>
      </td>
    </tr></table>`;

  const paymentBlock = `
    <h2 style="margin:24px 0 4px;font-family:${FONT};font-size:17px;color:${TEXT};">Payment summary</h2>
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
      ${moneyRow('Total amount', data.totalAmount)}
      ${moneyRow('Paid now (deposit)', data.amountPaidNow, { bold: true, color: '#1f7a3f', last: true })}
    </table>
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:12px 0 0;"><tr>
      <td style="padding:14px 16px;background:#fff8e6;border:1px solid #f0b429;border-radius:6px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:${FONT};font-size:14px;font-weight:bold;color:${TEXT};">Balance due on arrival</td>
          <td align="right" style="font-family:${FONT};font-size:18px;font-weight:bold;color:${TEXT};">${safe(data.balanceDue)}</td>
        </tr></table>
      </td>
    </tr></table>
    <p style="margin:12px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">${safe(data.depositNotice)}</p>`;

  const qrBlock = data.qrCid
    ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr>
        <td align="center" style="padding:24px 16px;background:${BRAND_LIGHT};border-radius:8px;">
          <h2 style="margin:0 0 4px;font-family:${FONT};font-size:17px;color:${TEXT};">Your check-in pass</h2>
          <p style="margin:0 0 16px;font-family:${FONT};font-size:14px;color:${MUTED};">Show this QR code to our staff when you arrive.</p>
          <div style="display:inline-block;padding:12px;background:#ffffff;border:1px solid ${BORDER};border-radius:8px;">
            <img src="cid:${safe(data.qrCid)}" width="220" height="220" alt="QR code for reservation ${safe(data.bookingReference)}" style="display:block;width:220px;height:220px;" />
          </div>
          <p style="margin:12px 0 0;font-family:'Courier New',Courier,monospace;font-size:13px;color:${MUTED};">${safe(data.bookingReference)}</p>
        </td>
      </tr></table>`
    : '';

  const locationBlock = location
    ? `<div style="margin:28px 0 0;padding-top:24px;border-top:1px solid ${BORDER};">
        <h2 style="margin:0 0 12px;font-family:${FONT};font-size:17px;color:${TEXT};">Find us</h2>
        ${location.mapCid ? `<img src="cid:${safe(location.mapCid)}" width="100%" alt="Map showing ${safe(location.resortName)}" style="display:block;width:100%;max-width:560px;height:auto;margin:0 0 16px;border-radius:8px;" />` : ''}
        <p style="margin:0;font-family:${FONT};font-size:15px;font-weight:bold;color:${TEXT};">${safe(location.resortName)}</p>
        <p style="margin:4px 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${MUTED};">${safe(location.address)}</p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:16px 0 0;"><tr>
          <td bgcolor="${BRAND}" style="border-radius:6px;">
            <a href="${safe(location.directionsUrl)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:14px;color:#ffffff;font-weight:bold;text-decoration:none;">Get directions</a>
          </td>
        </tr></table>
      </div>`
    : '';

  const html = renderEmail(
    'Payment accepted',
    `<p style="margin:0 0 6px;font-family:${FONT};font-size:16px;color:${TEXT};">Dear ${safe(data.guestName)},</p>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;line-height:1.5;color:${TEXT};">Your payment has been verified and your reservation is <strong style="color:#1f7a3f;">confirmed</strong>. We look forward to welcoming you!</p>
    ${referenceBlock}
    ${stayBlock}
    ${paymentBlock}
    ${qrBlock}
    ${locationBlock}`,
    location?.resortName
  );

  const textDates = isVenue
    ? `Event date: ${eventDate}`
    : `Check-in: ${checkIn} (from 2:00 PM)\nCheck-out: ${checkOut} (until 12:00 noon)`;

  return {
    to: data.to,
    subject: `Payment accepted - ${data.bookingReference}`,
    html,
    text: `Payment accepted\n\nDear ${data.guestName},\n\nYour payment has been verified and your reservation is confirmed.\n\nBooking reference: ${data.bookingReference}\n${textDates}\n\nTotal amount: ${data.totalAmount}\nPaid now (deposit): ${data.amountPaidNow}\nBalance due on arrival: ${data.balanceDue}\n${data.depositNotice}${data.qrCid ? `\n\nReservation QR code: ${data.bookingReference}\nShow this QR code to our staff when you arrive.` : ''}${location ? `\n\nFind us\n${location.resortName}\n${location.address}\nGet directions: ${location.directionsUrl}` : ''}`,
  };
};