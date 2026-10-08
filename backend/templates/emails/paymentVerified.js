const { escapeHtml, renderEmail, detail } = require('./templateUtils');

module.exports = function paymentVerified(data) {
  const isVenue = data.eventDate !== 'Not specified';
  const dates = isVenue
    ? detail('Event date', data.eventDate)
    : `${detail('Check-in', data.checkInDate)}${detail('Check-out', data.checkOutDate)}`;
  const html = renderEmail(
    'Payment accepted',
    `<p>Dear ${escapeHtml(data.guestName)},</p>
     <p>Your payment has been verified and your reservation is confirmed.</p>
     ${detail('Booking reference', data.bookingReference)}
    ${detail('Amount paid now', data.amountPaidNow)}
    ${detail('Total amount', data.totalAmount)}
    ${detail('Balance due on arrival', data.balanceDue)}
    <p>${data.depositNotice}</p>
    ${dates}
    ${data.qrCid ? `<div style="margin:24px 0;text-align:center;"><img src="cid:${escapeHtml(data.qrCid)}" width="300" height="300" alt="QR code for reservation ${escapeHtml(data.bookingReference)}" /><p style="margin:8px 0 0;font-family:monospace;">${escapeHtml(data.bookingReference)}</p><p style="margin:8px 0 0;">Present this QR code at check-in.</p></div>` : ''}`
  );
  const textDates = isVenue
    ? `Event date: ${data.eventDate}`
    : `Check-in: ${data.checkInDate}\nCheck-out: ${data.checkOutDate}`;
  return {
    to: data.to,
    subject: `Payment accepted - ${data.bookingReference}`,
    html,
    text: `Payment accepted\n\nDear ${data.guestName},\n\nYour payment has been verified and your reservation is confirmed.\n\nBooking reference: ${data.bookingReference}\nAmount paid now: ${data.amountPaidNow}\nTotal amount: ${data.totalAmount}\nBalance due on arrival: ${data.balanceDue}\n${data.depositNotice}\n${textDates}${data.qrCid ? `\n\nReservation QR code: ${data.bookingReference}\nPresent this QR code at check-in.` : ''}`,
  };
};