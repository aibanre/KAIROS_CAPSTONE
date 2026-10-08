const { escapeHtml, renderEmail, detail } = require('./templateUtils');

module.exports = function paymentRejected(data) {
  const reason = data.rejectionReason ? detail('Reason', data.rejectionReason) : '';
  const html = renderEmail(
    'Payment declined',
    `<p>Dear ${escapeHtml(data.guestName)},</p>
     <p>Your payment was declined, so the reservation is not confirmed.</p>
     ${detail('Booking reference', data.bookingReference)}
    ${detail('Amount paid now', data.amountPaidNow)}
    ${detail('Total amount', data.totalAmount)}
    ${detail('Balance due on arrival', data.balanceDue)}
    <p>${data.depositNotice}</p>
     ${reason}
     <p>Please contact the resort or resubmit your proof of payment.</p>`
  );
  return {
    to: data.to,
    subject: `Payment declined - ${data.bookingReference}`,
    html,
    text: `Payment declined\n\nDear ${data.guestName},\n\nYour payment was declined, so the reservation is not confirmed.\n\nBooking reference: ${data.bookingReference}\nAmount paid now: ${data.amountPaidNow}\nTotal amount: ${data.totalAmount}\nBalance due on arrival: ${data.balanceDue}\n${data.depositNotice}${data.rejectionReason ? `\nReason: ${data.rejectionReason}` : ''}\n\nPlease contact the resort or resubmit your proof of payment.`,
  };
};