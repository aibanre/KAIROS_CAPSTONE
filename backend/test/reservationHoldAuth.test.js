process.env.JWT_SECRET = 'reservation-hold-auth-test-secret-with-sufficient-length';

const assert = require('node:assert/strict');
const test = require('node:test');
const pool = require('../config/db');

let activeScenario;

pool.getConnection = async () => {
  const scenario = activeScenario;
  return {
    async beginTransaction() {},
    async commit() { scenario.committed = true; },
    async rollback() { scenario.rolledBack = true; },
    release() {},
    async query(sql, params = []) {
      const statement = sql.replace(/\s+/g, ' ').trim();
      scenario.queries.push({ statement, params });

      if (statement.startsWith('SELECT room_id, venue_id FROM Reservations')) {
        return [[{ room_id: scenario.reservation.room_id, venue_id: scenario.reservation.venue_id }], []];
      }
      if (statement.startsWith('SELECT room_id FROM Rooms')) {
        return [[{ room_id: scenario.reservation.room_id }], []];
      }
      if (statement.startsWith('SELECT reservation_id, customer_id, status, hold_expires_at')) {
        return [[scenario.reservation], []];
      }
      if (statement.startsWith('SELECT * FROM Customer WHERE customer_id = ? FOR UPDATE')) {
        scenario.customerLookupIds.push(params[0]);
        return [[scenario.customer], []];
      }
      if (statement.startsWith('SELECT * FROM Customer') && statement.includes('(email = ? OR phone_number = ?)')) {
        return [scenario.matchingCustomers, []];
      }
      if (statement.startsWith('UPDATE Customer SET first_name')) {
        scenario.customerUpdateParams = params;
        return [{ affectedRows: 1 }, []];
      }
      if (statement.startsWith('SELECT reservation_id, booking_reference, hold_expires_at, total_amount FROM Reservations')) {
        return [[{ reservation_id: scenario.reservation.reservation_id, booking_reference: 'KAB-TEST' }], []];
      }
      throw new Error(`Unexpected query: ${statement}`);
    },
  };
};

const { updateReservationHold } = require('../controllers/reservationController');
const { signReservationToken } = require('../utils/reservationToken');

function makeScenario({ reservationCustomerId = 55, customer, matchingCustomers = [] } = {}) {
  return {
    reservation: {
      reservation_id: 101,
      room_id: 7,
      venue_id: null,
      customer_id: reservationCustomerId,
      status: 'payment_pending',
      hold_expires_at: new Date(Date.now() + 10 * 60 * 1000),
    },
    customer,
    matchingCustomers,
    customerLookupIds: [],
    customerUpdateParams: null,
    queries: [],
    committed: false,
    rolledBack: false,
  };
}

function makeRequest({ user, reservationId = 101, token } = {}) {
  return {
    params: { id: String(reservationId) },
    user,
    headers: token ? { 'x-reservation-token': token } : {},
    body: {
      first_name: 'Form',
      last_name: 'Name',
      email: 'registered@example.test',
      phone_number: '09123456789',
      address: '1 Resort Road',
    },
  };
}

function makeResponse() {
  return {
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('another customer cannot update a hold', async () => {
  activeScenario = makeScenario({
    customer: { customer_id: 55, email: 'owner@example.test', is_active: 1 },
  });
  const response = makeResponse();

  await updateReservationHold(makeRequest({ user: { user_id: 56, role: 'customer' } }), response);

  assert.equal(response.statusCode, 403);
  assert.equal(activeScenario.customerLookupIds.length, 0);
  assert.equal(activeScenario.rolledBack, true);
});

test('the owner updates a hold using the session customer ID and email', async () => {
  activeScenario = makeScenario({
    customer: { customer_id: 55, email: 'owner@example.test', is_active: 1, is_registered: 1 },
  });
  const response = makeResponse();

  await updateReservationHold(makeRequest({ user: { user_id: '055', role: 'customer' } }), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(activeScenario.customerLookupIds, ['055']);
  assert.equal(activeScenario.customerUpdateParams[2], 'owner@example.test');
  assert.equal(activeScenario.queries.some(({ statement }) => statement.includes('(email = ? OR phone_number = ?)')), false);
  assert.equal(activeScenario.committed, true);
});

test('a guest hold with a registered email still returns 409', async () => {
  activeScenario = makeScenario({
    reservationCustomerId: 101,
    customer: {
      customer_id: 101,
      email: 'placeholder@example.test',
      first_name: 'HOLD',
      phone_number: 'HOLD-123',
      is_registered: 0,
    },
    matchingCustomers: [{ customer_id: 202, email: 'registered@example.test', is_registered: 1 }],
  });
  const token = signReservationToken(101);
  const response = makeResponse();

  await updateReservationHold(makeRequest({ token }), response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error, 'An account with this email already exists. Please log in to book.');
  assert.equal(activeScenario.rolledBack, true);
});