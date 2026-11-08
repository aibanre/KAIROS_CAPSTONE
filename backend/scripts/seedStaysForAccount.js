/**
 * backend/scripts/seedStaysForAccount.js
 *
 * For an EXISTING customer (default: ivanrocat13@gmail.com) seeds:
 *   A) 5 completed room stays in the past (reviewable: no reviews are created)
 *   B) 5 checked-in room reservations whose check_out_date is TODAY (Asia/Manila)
 *
 *   node scripts/seedStaysForAccount.js                       # cleanup, then seed
 *   node scripts/seedStaysForAccount.js --cleanup             # remove what this script seeded
 *   node scripts/seedStaysForAccount.js --email=someone@x.com # another existing customer
 *
 * Run it from inside backend/. It prints the database and host it connects to.
 *
 * Safe cleanup: seeded reservations are identified by the customer AND a marker
 * written to Reservation_Status_History.reason (not by reference pattern), and
 * temporary rooms by the SEED-ACCT- prefix AND a marker in Rooms.description.
 * Anything else is never touched.
 */
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const pool = require('../config/db');
const { recordReservationStatusHistory } = require('../utils/reservationStatusHistory');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run with NODE_ENV=production.');
  process.exit(1);
}

const EMAIL = (process.argv.find((a) => a.startsWith('--email=')) || '').slice(8) || 'ivanrocat13@gmail.com';
const MARKER = 'Seeded: stays for account';
const ROOM_MARKER = 'Temporary room (seedStaysForAccount)';
const TEMP_PREFIX = 'SEED-ACCT-';
const TEMP_ROOM_PRICE = 2500;
const DEPOSIT_PERCENTAGE = 50;
const EARLY_FEE_CENTS = 50000; // PHP 500
const LIVE = ['payment_pending', 'pending_verification', 'confirmed', 'checked_in'];
const NOT_CANCELLED = [...LIVE, 'completed'];

// Completed stays: how many days ago they ended, and how long they were.
const COMPLETED = [
  { endAgo: 7, nights: 1 },
  { endAgo: 14, nights: 2 },
  { endAgo: 30, nights: 3 },
  { endAgo: 50, nights: 2 },
  { endAgo: 75, nights: 1 },
];

// Check-out-today stays, each hitting a different checkout branch.
const TODAYS = [
  { nights: 3, payments: ['deposit', 'balance'], note: 'paid in full -> clean check-out' },
  { nights: 2, payments: ['deposit', 'balance'], note: 'paid in full -> clean check-out' },
  { nights: 1, payments: ['deposit'], note: 'balance due -> check-out blocked (409)' },
  { nights: 2, payments: ['deposit'], note: 'balance due -> check-out blocked (409)' },
  { nights: 3, payments: ['deposit', 'balance'], earlyFeeCents: EARLY_FEE_CENTS, note: 'only the early-fee is due' },
];

const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const pesos = (cents) => (cents / 100).toFixed(2);

async function cleanup(conn, customerId) {
  const [rows] = await conn.query(
    `SELECT DISTINCT r.reservation_id
       FROM Reservations r
       JOIN Reservation_Status_History h ON h.reservation_id = r.reservation_id
      WHERE r.customer_id = ? AND h.reason = ?`,
    [customerId, MARKER]
  );
  const ids = rows.map((r) => r.reservation_id);

  if (ids.length) {
    const steps = [
      [`DELETE FROM Reservation_Inventory_Lines WHERE check_id IN (SELECT check_id FROM Reservation_Inventory_Checks WHERE reservation_id IN (?))`, [ids]],
      [`DELETE FROM Reservation_Inventory_Checks WHERE reservation_id IN (?)`, [ids]],
      [`DELETE FROM Reservation_Addons WHERE reservation_id IN (?)`, [ids]],
      [`DELETE FROM Reviews WHERE reservation_id IN (?)`, [ids]],
      [`DELETE FROM Payments WHERE reservation_id IN (?)`, [ids]],
      [`DELETE FROM Reservation_Status_History WHERE reservation_id IN (?)`, [ids]],
      [`DELETE FROM Reservations WHERE reservation_id IN (?)`, [ids]],
    ];
    for (const [sql, params] of steps) {
      try {
        await conn.query(sql, params);
      } catch (err) {
        if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
      }
    }
  }

  // Temporary rooms: only ours (prefix + marker) and only if nothing references them.
  const [rooms] = await conn.query(
    `SELECT r.room_id FROM Rooms r
      WHERE r.room_number LIKE ? AND r.description = ?
        AND NOT EXISTS (SELECT 1 FROM Reservations x WHERE x.room_id = r.room_id)`,
    [`${TEMP_PREFIX}%`, ROOM_MARKER]
  );
  const roomIds = rooms.map((r) => r.room_id);
  if (roomIds.length) {
    try {
      await conn.query('DELETE FROM room_inventory WHERE room_id IN (?)', [roomIds]);
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }
    await conn.query('DELETE FROM Rooms WHERE room_id IN (?)', [roomIds]);
  }
  return { reservations: ids.length, rooms: roomIds.length };
}

// A free real room for [checkIn, checkOut); creates a temporary room if none is free.
async function pickRoom(conn, checkIn, checkOut, statuses, state) {
  const [[room]] = await conn.query(
    `SELECT r.room_id, r.room_number, r.price_per_night
       FROM Rooms r
      WHERE r.status = 'available' AND r.room_number NOT LIKE 'SEED-%'
        AND NOT EXISTS (
          SELECT 1 FROM Reservations x
           WHERE x.room_id = r.room_id AND x.status IN (?)
             AND x.check_in_date < ? AND x.check_out_date > ?)
      ORDER BY r.room_id LIMIT 1`,
    [statuses, checkOut, checkIn]
  );
  if (room) return room;

  for (;;) {
    const number = `${TEMP_PREFIX}${state.nextTemp}`;
    state.nextTemp += 1;
    const [[taken]] = await conn.query('SELECT 1 AS x FROM Rooms WHERE room_number = ?', [number]);
    if (taken) continue; // never reuse a name that already exists
    const [res] = await conn.query(
      `INSERT INTO Rooms (room_number, room_type, capacity, price_per_night, description, status)
       VALUES (?, 'Seed Room', 4, ?, ?, 'available')`,
      [number, TEMP_ROOM_PRICE, ROOM_MARKER]
    );
    await conn.query(
      `INSERT INTO room_inventory (room_id, item_id, expected_quantity)
       SELECT ?, item_id, 1 FROM Inventory_Items WHERE is_active = 1`,
      [res.insertId]
    );
    state.tempCreated += 1;
    return { room_id: res.insertId, room_number: number, price_per_night: TEMP_ROOM_PRICE };
  }
}

async function createStay(conn, ctx, s) {
  const baseCents = Math.round(Number(s.room.price_per_night) * 100) * s.nights;
  const depositCents = Math.round((baseCents * DEPOSIT_PERCENTAGE) / 100);
  const amounts = { deposit: depositCents, balance: baseCents - depositCents };

  const [res] = await conn.query(
    `INSERT INTO Reservations
       (customer_id, room_id, booking_source, booking_reference, check_in_date, check_out_date,
        num_guests, total_amount, actual_check_in, actual_check_out, early_checkin_fee, status, created_at)
     VALUES (?, ?, 'online', ?, ?, ?, 2, ?, ?, ?, ?, ?, ?)`,
    [
      ctx.customerId, s.room.room_id, s.ref, s.checkIn, s.checkOut, pesos(baseCents),
      `${s.checkIn} 14:05:00`,
      s.status === 'completed' ? `${s.checkOut} 10:40:00` : null,
      pesos(s.earlyFeeCents || 0), s.status,
      `${addDays(s.checkIn, -5)} 03:00:00`,
    ]
  );
  const reservationId = res.insertId;

  let paid = 0;
  for (const type of s.payments) {
    const when = type === 'deposit' ? `${addDays(s.checkIn, -2)} 02:00:00` : `${s.checkIn} 06:00:00`;
    paid += amounts[type];
    await conn.query(
      `INSERT INTO Payments
         (reservation_id, payment_method_id, amount, payment_type, payment_status, verified_by, verified_at, created_at)
       VALUES (?, ?, ?, ?, 'verified', ?, ?, ?)`,
      [reservationId, ctx.cashId, pesos(amounts[type]), type, ctx.adminId, when, when]
    );
  }

  await recordReservationStatusHistory(conn, reservationId, null, 'confirmed', 'staff', ctx.adminId, MARKER);
  await recordReservationStatusHistory(conn, reservationId, 'confirmed', 'checked_in', 'staff', ctx.adminId, MARKER);
  if (s.status === 'completed') {
    await recordReservationStatusHistory(conn, reservationId, 'checked_in', 'completed', 'staff', ctx.adminId, MARKER);
  }

  const balance = baseCents + (s.earlyFeeCents || 0) - paid;
  console.log(`${s.ref}  room ${s.room.room_number}  ${s.checkIn} -> ${s.checkOut}  ${s.status.padEnd(10)}  balance due PHP ${pesos(balance)}${s.note ? `  | ${s.note}` : ''}`);
}

async function main() {
  const cleanupOnly = process.argv.includes('--cleanup');
  const conn = await pool.getConnection();

  try {
    const [[where]] = await conn.query('SELECT DATABASE() AS db, @@hostname AS host');
    console.log(`Database: ${where.db} on ${where.host}`);

    const [[customer]] = await conn.query('SELECT customer_id, is_active FROM Customer WHERE email = ?', [EMAIL]);
    if (!customer || !customer.is_active) {
      throw new Error(`No active customer with email ${EMAIL}. Create the account first; this script never creates it.`);
    }

    await conn.beginTransaction();
    const removed = await cleanup(conn, customer.customer_id);
    console.log(`Removed previous seed: ${removed.reservations} reservations, ${removed.rooms} temporary rooms.`);
    if (cleanupOnly) {
      await conn.commit();
      return;
    }

    const [[admin]] = await conn.query(`SELECT user_id FROM Users WHERE role = 'admin' AND is_active = 1 LIMIT 1`);
    if (!admin) throw new Error('No active admin user found. Run createAdmin.js first.');
    const [[cash]] = await conn.query(`SELECT payment_method_id FROM PaymentMethods WHERE method_type = 'cash' LIMIT 1`);
    if (!cash) throw new Error('No cash payment method found.');

    const today = manilaToday();
    const [yyyy, mm] = today.split('-');

    // Fixed references for today's stays must be free.
    const todayRefs = TODAYS.map((_, i) => `KAB-${yyyy}-${mm}-${7001 + i}`);
    const [clash] = await conn.query('SELECT booking_reference FROM Reservations WHERE booking_reference IN (?)', [todayRefs]);
    if (clash.length) {
      throw new Error(`Reference(s) already taken: ${clash.map((r) => r.booking_reference).join(', ')}. Not overwriting them.`);
    }

    // Completed stays continue after the highest existing 9xxx reference this month.
    const [[maxRow]] = await conn.query(
      `SELECT MAX(CAST(RIGHT(booking_reference, 4) AS UNSIGNED)) AS m FROM Reservations WHERE booking_reference LIKE ?`,
      [`KAB-${yyyy}-${mm}-9___`]
    );
    let nextCompleted = Math.max(Number(maxRow.m) || 0, 9000) + 1;
    if (nextCompleted + COMPLETED.length - 1 > 9999) throw new Error('No free 9xxx references left this month.');

    const ctx = { customerId: customer.customer_id, adminId: admin.user_id, cashId: cash.payment_method_id };
    const state = { nextTemp: 1, tempCreated: 0 };

    // Today's stays first: each needs its own room.
    for (let i = 0; i < TODAYS.length; i += 1) {
      const t = TODAYS[i];
      const checkIn = addDays(today, -t.nights);
      const room = await pickRoom(conn, checkIn, today, LIVE, state);
      await createStay(conn, ctx, { ...t, room, ref: todayRefs[i], checkIn, checkOut: today, status: 'checked_in' });
    }

    for (const c of COMPLETED) {
      const checkOut = addDays(today, -c.endAgo);
      const checkIn = addDays(checkOut, -c.nights);
      const room = await pickRoom(conn, checkIn, checkOut, NOT_CANCELLED, state);
      const ref = `KAB-${yyyy}-${mm}-${nextCompleted}`;
      nextCompleted += 1;
      await createStay(conn, ctx, { nights: c.nights, payments: ['deposit', 'balance'], room, ref, checkIn, checkOut, status: 'completed' });
    }

    await conn.commit();
    if (state.tempCreated) console.log(`\nNot enough free rooms: created ${state.tempCreated} temporary ${TEMP_PREFIX}* room(s).`);
    console.log(`\nDone for ${EMAIL}.`);
  } catch (err) {
    await conn.rollback();
    console.error('Seed failed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    if (pool.end) await pool.end();
  }
}

main();