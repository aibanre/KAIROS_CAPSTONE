process.env.MAX_ACTIVE_HOLDS_PER_VISITOR = '2';
process.env.MAX_UNREVIEWED_PER_VISITOR = '3';
process.env.JWT_SECRET = 'reservation-cap-test-secret-with-sufficient-length';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  acquireReservationIdentityLock,
  getReservationIdentity,
  getVisitorReservations,
  releaseReservationIdentityLock,
  summarizeVisitorReservations,
  unreviewedReservationCapReached,
  visitorReservationCapReached,
} = require('../utils/reservationCaps');

function activeHold(reservationId, active = 1) {
  return {
    reservation_id: reservationId,
    status: 'payment_pending',
    active_hold: active,
  };
}

test('the default active-hold cap allows two holds and blocks a third', () => {
  assert.equal(visitorReservationCapReached([activeHold(1), activeHold(2)]), true);
  assert.equal(visitorReservationCapReached([activeHold(1)]), false);
});

test('an expired hold does not consume active-hold capacity', () => {
  const counts = summarizeVisitorReservations([activeHold(1), activeHold(2, 0)]);
  assert.equal(counts.activeHolds.length, 1);
  assert.equal(visitorReservationCapReached([activeHold(1), activeHold(2, 0)]), false);
});

test('replacing the same resource excludes that visitor hold from the cap', () => {
  assert.equal(visitorReservationCapReached([activeHold(1), activeHold(2)], [1]), false);
});

test('pending-verification reservations use their separate cap', () => {
  const pending = [1, 2, 3].map((reservationId) => ({
    reservation_id: reservationId,
    status: 'pending_verification',
    active_hold: 0,
  }));
  assert.equal(unreviewedReservationCapReached(pending), true);
  assert.equal(visitorReservationCapReached(pending), true);
});

test('guest and logged-in visitor identities are distinct and staff are exempt', () => {
  assert.deepEqual(
    getReservationIdentity({ reservationVisitorKey: 'guest-key' }),
    { type: 'visitor', value: 'guest-key' },
  );
  assert.deepEqual(
    getReservationIdentity({ user: { role: 'customer', user_id: 42 }, reservationVisitorKey: 'guest-key' }),
    { type: 'customer', value: 42 },
  );
  assert.equal(getReservationIdentity({ user: { role: 'admin', user_id: 7 } }), null);
});

test('active-hold queries count only online payment-pending rows with strict future expiry', async () => {
  let queryText = '';
  const executor = {
    async query(sql) {
      queryText = sql;
      return [[]];
    },
  };
  await getVisitorReservations(executor, { type: 'visitor', value: 'guest-key' });
  assert.match(queryText, /booking_source = 'online'/);
  assert.match(queryText, /status = 'payment_pending' AND hold_expires_at > NOW\(\)/);
  assert.doesNotMatch(queryText, /hold_expires_at IS NULL/);
});

function createNamedLockConnection() {
  const queues = createNamedLockConnection.queues;
  let releaseCurrent;
  return {
    async query(sql, [name]) {
      if (sql.includes('GET_LOCK')) {
        const previous = queues.get(name) || Promise.resolve();
        let release;
        const current = new Promise((resolve) => { release = resolve; });
        queues.set(name, current);
        await previous;
        releaseCurrent = () => {
          release();
          if (queues.get(name) === current) queues.delete(name);
        };
        return [[{ acquired: 1 }]];
      }
      if (sql.includes('RELEASE_LOCK')) {
        releaseCurrent?.();
        releaseCurrent = null;
        return [[{ released: 1 }]];
      }
      throw new Error(`Unexpected lock query: ${sql}`);
    },
  };
}
createNamedLockConnection.queues = new Map();

test('simultaneous requests for one visitor serialize, while other visitors remain independent', async () => {
  const reservationsByIdentity = new Map();
  async function tryCreate(identity) {
    const connection = createNamedLockConnection();
    const lockName = await acquireReservationIdentityLock(connection, identity);
    try {
      const key = `${identity.type}:${identity.value}`;
      const reservations = reservationsByIdentity.get(key) || [];
      if (visitorReservationCapReached(reservations)) return false;
      await new Promise((resolve) => setTimeout(resolve, 5));
      reservations.push(activeHold(reservations.length + 1));
      reservationsByIdentity.set(key, reservations);
      return true;
    } finally {
      await releaseReservationIdentityLock(connection, lockName);
    }
  }

  const guestIdentity = { type: 'visitor', value: 'guest-a' };
  const guestResults = await Promise.all([
    tryCreate(guestIdentity),
    tryCreate(guestIdentity),
    tryCreate(guestIdentity),
  ]);
  assert.equal(guestResults.filter(Boolean).length, 2);

  const otherGuestIdentity = { type: 'visitor', value: 'guest-b' };
  assert.equal(await tryCreate(otherGuestIdentity), true);

  const customerIdentity = { type: 'customer', value: 42 };
  const customerResults = await Promise.all([
    tryCreate(customerIdentity),
    tryCreate(customerIdentity),
    tryCreate(customerIdentity),
  ]);
  assert.equal(customerResults.filter(Boolean).length, 2);
});
