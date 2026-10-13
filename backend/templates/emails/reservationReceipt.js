const { renderEmail } = require('./templateUtils');
const {
  formatDate,
  humanize,
  greeting,
  statusBanner,
  referenceBlock,
  dateBlock,
  infoRows,
  sectionTitle,
  paymentSummary,
} = require('./emailBlocks');

module.exports = function reservationReceipt(data) {
  const isVenue = data.eventDate !== 'Not specified';

  const html = renderEmail(
    'Reservation receipt',
    `${greeting(data.guestName)}
    ${statusBanner('Pending verification', 'We received your reservation and payment proof. We will email you again once it has been reviewed.', 'warning')}
    ${referenceBlock(data.bookingReference)}
    ${infoRows([['Room or venue', data.resourceName, { bold: true }]])}
    <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
    ${dateBlock({
      isVenue,
      eventDate: data.eventDate,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
    })}
    ${paymentSummary({
      totalAmount: data.totalAmount,
      paidLabel: 'Amount paid now',
      paidAmount: data.amountPaidNow,
      balanceDue: data.balanceDue,
      notice: data.depositNotice,
    })}
    ${sectionTitle('Payment details')}
    ${infoRows([
      ['Payment method', data.paymentMethod],
      ['Payment status', humanize(data.paymentStatus)],
    ])}`
  );

  const textDates = isVenue
    ? `Event date: ${formatDate(data.eventDate)}`
    : `Check-in: ${formatDate(data.checkInDate)} (from 2:00 PM)\nCheck-out: ${formatDate(data.checkOutDate)} (until 12:00 noon)`;

  return {
    to: data.to,
    subject: `Reservation receipt - ${data.bookingReference}`,
    html,
    text: `Reservation receipt\n\nDear ${data.guestName},\n\nBooking reference: ${data.bookingReference}\nRoom or venue: ${data.resourceName}\n${textDates}\nAmount paid now: ${data.amountPaidNow}\nTotal amount: ${data.totalAmount}\nBalance due on arrival: ${data.balanceDue}\nPayment method: ${data.paymentMethod}\nPayment status: ${humanize(data.paymentStatus)}\n\n${data.depositNotice}\nYour payment is pending verification. We will email you again once it has been reviewed.`,
  };
};