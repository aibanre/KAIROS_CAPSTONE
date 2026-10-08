const { escapeHtml, renderEmail, detail } = require('./templateUtils');

module.exports = function reservationReceipt(data) {
  const isVenue = data.eventDate !== 'Not specified';
  const dates = isVenue
    ? detail('Event date', data.eventDate)
    : `${detail('Check-in', data.checkInDate)}${detail('Check-out', data.checkOutDate)}`;
  const html = renderEmail(
    'Reservation receipt',
    `<p>Dear ${escapeHtml(data.guestName)},</p>
     <p>We received your reservation and payment proof.</p>
     ${detail('Booking reference', data.bookingReference)}
     ${detail('Room or venue', data.resourceName)}
     ${dates}
    ${detail('Amount paid now', data.amountPaidNow)}
    ${detail('Total amount', data.totalAmount)}
    ${detail('Balance due on arrival', data.balanceDue)}
     ${detail('Payment method', data.paymentMethod)}
     ${detail('Payment status', data.paymentStatus)}
    <p style="margin-top:20px;">${data.depositNotice}</p>
    <p>Your payment is pending verification. We will email you again once it has been reviewed.</p>`
  );
  const textDates = isVenue
    ? `Event date: ${data.eventDate}`
    : `Check-in: ${data.checkInDate}\nCheck-out: ${data.checkOutDate}`;
  return {
    to: data.to,
    subject: `Reservation receipt - ${data.bookingReference}`,
    html,
    text: `Reservation receipt\n\nDear ${data.guestName},\n\nBooking reference: ${data.bookingReference}\nRoom or venue: ${data.resourceName}\n${textDates}\nAmount paid now: ${data.amountPaidNow}\nTotal amount: ${data.totalAmount}\nBalance due on arrival: ${data.balanceDue}\nPayment method: ${data.paymentMethod}\nPayment status: ${data.paymentStatus}\n\n${data.depositNotice}\nYour payment is pending verification. We will email you again once it has been reviewed.`,
  };
};