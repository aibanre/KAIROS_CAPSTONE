const crypto = require('crypto');
const { signReservationToken } = require('./reservationToken');

function positiveIntegerEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

const MAX_ACTIVE_HOLDS_PER_VISITOR = positiveIntegerEnv('MAX_ACTIVE_HOLDS_PER_VISITOR', 2);
const MAX_UNREVIEWED_PER_VISITOR = positiveIntegerEnv('MAX_UNREVIEWED_PER_VISITOR', 3);
const MAX_ACTIVE_HOLDS_PER_IP = positiveIntegerEnv('MAX_ACTIVE_HOLDS_PER_IP', 6);
const RESERVATION_CAP_MESSAGE = 'Your booking limit has been reached. Continue an existing reservation or try again later.';

function getReservationIdentity(req, reservation = null) {
  if (req.accessMode === 'staff' || ['admin', 'receptionist'].includes(req.user?.role)) return null;
  if (req.user?.role === 'customer') {
    return { type: 'customer', value: Number(reservation?.customer_id ?? req.user.user_id) };
  }
  if (reservation?.visitor_key) return { type: 'visitor', value: reservation.visitor_key };
  if (req.reservationVisitorKey) return { type: 'visitor', value: req.reservationVisitorKey };
  if (reservation?.customer_id) return { type: 'legacy_customer', value: Number(reservation.customer_id) };
  return null;
}

function identityLockName(identity) {
  if (!identity) return null;
  const digest = crypto.createHash('sha256').update(`${identity.type}:${identity.value}`).digest('hex');
  return `rescap:${digest.slice(0, 56)}`;
}

async function acquireReservationIdentityLock(connection, identity) {
  const lockName = identityLockName(identity);
  if (!lockName) return null;
  const [[result]] = await connection.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
  if (Number(result?.acquired) !== 1) {
    const error = new Error('Could not acquire the reservation limit lock.');
    error.code = 'RESERVATION_LIMIT_LOCK_TIMEOUT';
    throw error;
  }
  return lockName;
}

async function releaseReservationIdentityLock(connection, lockName) {
  if (lockName) await connection.query('SELECT RELEASE_LOCK(?) AS released', [lockName]);
}

function summarizeVisitorReservations(rows, excludedReservationIds = []) {
  const excluded = new Set(excludedReservationIds.map(Number));
  const remaining = rows.filter((row) => !excluded.has(Number(row.reservation_id)));
  return {
    activeHolds: remaining.filter((row) => Number(row.active_hold) === 1),
    unreviewed: remaining.filter((row) => row.status === 'pending_verification'),
    reservations: remaining,
  };
}

async function getVisitorReservations(executor, identity) {
  if (!identity) return [];
  const ownerColumn = identity.type === 'visitor' ? 'visitor_key' : 'customer_id';
  const [rows] = await executor.query(
    `SELECT reservation_id, booking_reference, status, hold_expires_at,
            CASE WHEN status = 'payment_pending' AND hold_expires_at > NOW() THEN 1 ELSE 0 END AS active_hold
     FROM Reservations
     WHERE ${ownerColumn} = ? AND booking_source = 'online'
       AND ((status = 'payment_pending' AND hold_expires_at > NOW())
         OR status = 'pending_verification')
     ORDER BY created_at DESC, reservation_id DESC`,
    [identity.value],
  );
  return rows;
}

async function getReplaceableVisitorHolds(executor, identity, resourceType, resourceIds) {
  if (!identity || !resourceIds.length) return [];
  const ownerColumn = identity.type === 'visitor' ? 'visitor_key' : 'customer_id';
  const resourceColumn = resourceType === 'room' ? 'room_id' : 'venue_id';
  const [rows] = await executor.query(
    `SELECT reservation_id, customer_id, room_id, venue_id, check_in_date, check_out_date, event_date
     FROM Reservations
     WHERE ${ownerColumn} = ? AND booking_source = 'online'
       AND status = 'payment_pending' AND hold_expires_at > NOW()
       AND ${resourceColumn} IN (${resourceIds.map(() => '?').join(', ')})`,
    [identity.value, ...resourceIds],
  );
  return rows;
}

function isMissingVisitorKeyColumnError(error) {
  return error?.code === 'ER_BAD_FIELD_ERROR'
    && /visitor_key/i.test(error.message || '');
}

function visitorReservationCapReached(rows, excludedReservationIds = []) {
  const counts = summarizeVisitorReservations(rows, excludedReservationIds);
  return counts.activeHolds.length >= MAX_ACTIVE_HOLDS_PER_VISITOR
    || counts.unreviewed.length >= MAX_UNREVIEWED_PER_VISITOR;
}

function unreviewedReservationCapReached(rows) {
  return summarizeVisitorReservations(rows).unreviewed.length >= MAX_UNREVIEWED_PER_VISITOR;
}

function sendReservationCapResponse(res, req, rows) {
  res.set('Retry-After', '60');
  return res.status(429).json({
    error: RESERVATION_CAP_MESSAGE,
    existing_holds: buildResumeReservations(rows, req, signReservationToken),
  });
}

function buildResumeReservations(rows, req, signReservationToken) {
  return rows.map((row) => ({
    reservation_id: Number(row.reservation_id),
    booking_reference: row.booking_reference,
    status: row.status,
    hold_expires_at: row.hold_expires_at,
    ...(req.user?.role === 'customer'
      ? {}
      : { access_token: signReservationToken(row.reservation_id) }),
  }));
}

module.exports = {
  MAX_ACTIVE_HOLDS_PER_VISITOR,
  MAX_UNREVIEWED_PER_VISITOR,
  MAX_ACTIVE_HOLDS_PER_IP,
  RESERVATION_CAP_MESSAGE,
  acquireReservationIdentityLock,
  buildResumeReservations,
  getReplaceableVisitorHolds,
  getReservationIdentity,
  getVisitorReservations,
  isMissingVisitorKeyColumnError,
  releaseReservationIdentityLock,
  sendReservationCapResponse,
  summarizeVisitorReservations,
  unreviewedReservationCapReached,
  visitorReservationCapReached,
};
