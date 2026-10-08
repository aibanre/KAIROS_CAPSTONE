const BOOKING_BLOCKING_STATUSES = Object.freeze([
  'payment_pending',
  'pending_verification',
  'confirmed',
  'checked_in',
]);

function statusPlaceholders() {
  return BOOKING_BLOCKING_STATUSES.map(() => '?').join(', ');
}

function statusParams() {
  return [...BOOKING_BLOCKING_STATUSES];
}

const ACTIVE_HOLD_CLAUSE = `(status <> 'payment_pending' OR hold_expires_at IS NULL OR hold_expires_at >= NOW())`;

module.exports = {
  BOOKING_BLOCKING_STATUSES,
  ACTIVE_HOLD_CLAUSE,
  statusPlaceholders,
  statusParams,
};
