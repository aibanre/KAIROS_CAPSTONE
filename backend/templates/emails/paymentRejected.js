const { renderEmail } = require('./templateUtils');
const {
  greeting,
  statusBanner,
  callout,
  referenceBlock,
  paymentSummary,
} = require('./emailBlocks');

module.exports = function paymentRejected(data) {
  const html = renderEmail(
    'Payment declined',
    `${greeting(data.guestName)}
    ${statusBanner('Reservation not confirmed', 'Your payment was declined, so the reservation is not confirmed.', 'danger')}
    ${referenceBlock(data.bookingReference, 'danger')}
    ${data.rejectionReason ? callout('Reason from our team', data.rejectionReason, 'neutral') : ''}
    ${paymentSummary({
      totalAmount: data.totalAmount,
      paidLabel: 'Amount submitted',
      paidAmount: data.amountPaidNow,
      balanceDue: data.balanceDue,
      notice: data.depositNotice,
    })}
    ${callout('What to do next', 'Please contact the resort or resubmit your proof of payment.', 'warning')}`
  );

  return {
    to: data.to,
    subject: `Payment declined - ${data.bookingReference}`,
    html,
    text: `Payment declined\n\nDear ${data.guestName},\n\nYour payment was declined, so the reservation is not confirmed.\n\nBooking reference: ${data.bookingReference}\nAmount submitted: ${data.amountPaidNow}\nTotal amount: ${data.totalAmount}\nBalance due on arrival: ${data.balanceDue}\n${data.depositNotice}${data.rejectionReason ? `\nReason: ${data.rejectionReason}` : ''}\n\nPlease contact the resort or resubmit your proof of payment.`,
  };
};