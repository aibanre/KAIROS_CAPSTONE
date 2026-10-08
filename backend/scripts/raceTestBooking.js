require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../config/db');

const apiUrl = String(process.env.RACE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const requestCount = Number(process.env.RACE_REQUESTS || 10);
const roomId = Number(process.env.RACE_ROOM_ID || 1);
const checkIn = process.env.RACE_CHECK_IN || '2099-01-10';
const checkOut = process.env.RACE_CHECK_OUT || '2099-01-12';

function assertLocalApi() {
  const parsed = new URL(apiUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Refusing to run: RACE_API_URL must point to localhost.');
  }
}

function bookingBody(email) {
  return {
    room_id: roomId,
    check_in: checkIn,
    check_out: checkOut,
    num_guests: 1,
    customer: {
      first_name: 'Race',
      last_name: 'Test',
      email,
      phone_number: '09999999999',
      address: 'Local race test',
    },
  };
}

async function main() {
  assertLocalApi();
  if (!Number.isInteger(requestCount) || requestCount < 2) throw new Error('RACE_REQUESTS must be an integer of at least 2.');
  if (!Number.isInteger(roomId) || roomId <= 0) throw new Error('RACE_ROOM_ID must be a positive integer.');

  const email = `race-test-${Date.now()}@localhost.invalid`;
  const responses = await Promise.all(Array.from({ length: requestCount }, () => fetch(`${apiUrl}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingBody(email)),
  }).then(async (response) => ({ status: response.status, body: await response.json().catch(() => ({})) }))));

  const created = responses.filter((response) => response.status === 201);
  const conflicts = responses.filter((response) => response.status === 409);
  console.log('Status codes:', responses.map((response) => response.status).join(', '));
  console.log(`Created: ${created.length}; conflicts: ${conflicts.length}`);

  for (const response of created) {
    await pool.query(
      `UPDATE Reservations
       SET status = 'cancelled', cancellation_reason = 'Automated race test cleanup.'
       WHERE reservation_id = ? AND status = 'payment_pending'`,
      [response.body.reservation_id]
    );
  }
  console.log(`Cleaned up ${created.length} test reservation(s).`);

  if (created.length !== 1 || conflicts.length !== requestCount - 1) {
    process.exitCode = 1;
    throw new Error(`Expected exactly one 201 and ${requestCount - 1} 409 responses.`);
  }
}

main()
  .catch((error) => {
    console.error(`[raceTestBooking] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
