/**
 * backend/scripts/seedCheckoutToday.js
 *
 * Seeds checked-in ROOM reservations whose check_out_date is TODAY (Asia/Manila)
 * so the staff check-out flow can be exercised end to end.
 *
 *   node backend/scripts/seedCheckoutToday.js            # reset + seed
 *   node backend/scripts/seedCheckoutToday.js --cleanup  # remove seeded rows only
 *   node backend/scripts/seedCheckoutToday.js --no-show  # seed a confirmed room reservation that ended yesterday
 *
 * Seeded rows are identified by guest emails ending in @checkout-seed.invalid
 * and booking references in the reserved KAB-YYYY-MM-8xxx range. Running the
 * script again first removes the previous seed, so you can reset after every
 * check-out test (check-out consumes the rows).
 *
 * Column names/enums are checked against backend/database/schema.sql, and the
 * check-out rules against adminReservationController.js (recordAttendance).
 * The pool (config/db.js) is a mysql2/promise createPool export, so getConnection()
 * and pool.end() are valid; path ../config/db is relative to backend/scripts.
 *
 * Check-out order in the controller: (1) reservation must be 'checked_in',
 * (2) a Reservation_Inventory_Checks row must exist (the room inspection, done
 * in the UI - this script deliberately does NOT create one), (3) after the
 * update, balance_due must be 0 or it returns 409. So the "balance-due" and
 * "early-fee" scenarios only reach the 409 after the inspection is completed.
 *
 * Room selection: each scenario gets a DISTINCT room. Rooms already picked in
 * this run are tracked in `usedRoomIds`, and every rejected room is logged with
 * the date range and the reason (not available / used by earlier scenario /
 * overlapping live reservation, with that reservation's reference and dates).
 */
const path = require('path');
// Load backend/.env first (what the server uses when started from backend/), so this
// script targets the SAME database no matter which directory it is launched from.
// dotenv never overrides variables that are already set, so the cwd .env only fills gaps.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const pool = require('../config/db'); // mysql2/promise pool (confirmed from config/db.js)
const { recordReservationStatusHistory } = require('../utils/reservationStatusHistory');
const { PLACEHOLDER_CUSTOMER_MARKER } = require('../config/reservationConfig'); // same import the controller uses
const { NO_RECEIPT_METHOD_TYPES } = require('../config/paymentPolicy'); // same import the controller uses

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run with NODE_ENV=production.');
  process.exit(1);
}

const EMAIL_DOMAIN = '@checkout-seed.invalid';
const SEED_FIRST_NAME = 'Checkout';
const DEPOSIT_PERCENTAGE = 50; // mirrors the backend constant
const EARLY_FEE_CENTS = 50000; // PHP 500, matches the attendance policy

// Same statuses as the original overlap check (unchanged).
const LIVE_STATUSES = ['payment_pending', 'pending_verification', 'confirmed', 'checked_in'];

// Each scenario hits a different branch of the check-out flow.
const SCENARIOS = [
  { key: 'paid-in-full', label: 'Deposit + balance verified -> clean check-out', nights: 3, source: 'online', payments: ['deposit', 'balance'] },
  { key: 'balance-due', label: 'Deposit only -> after inspection, check-out blocked with 409 until balance collected', nights: 2, source: 'online', payments: ['deposit'] },
  { key: 'early-fee', label: 'Deposit only + early check-in fee billed -> larger balance', nights: 2, source: 'online', payments: ['deposit'], earlyFeeCents: EARLY_FEE_CENTS },
  { key: 'walk-in-paid', label: 'Walk-in, single verified full payment -> clean check-out', nights: 1, source: 'walk-in', payments: ['full'] },
];
const NO_SHOW_SCENARIO = {
  key: 'no-show',
  label: 'Confirmed reservation with check-out yesterday and no check-in',
  nights: 1,
  source: 'online',
  payments: [],
  noShow: true,
};

const manilaToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()); // YYYY-MM-DD

const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const pesos = (cents) => (cents / 100).toFixed(2);

/**
 * Pick the first room (by room_id) that is 'available', not already used by an
 * earlier scenario in this run, and has no live reservation overlapping
 * [checkIn, checkOut). Overlap rule is the original one:
 *   existing.check_in_date < checkOut AND existing.check_out_date > checkIn
 * Logs every rejection. Returns the room row or null.
 */
async function pickRoom(conn, scenario, checkIn, checkOut, usedRoomIds) {
  const tag = `[${scenario.key}] ${checkIn} -> ${checkOut}`;

  const [rooms] = await conn.query(
    'SELECT room_id, room_number, price_per_night, status FROM Rooms ORDER BY room_id'
  );
  if (!rooms.length) {
    console.warn(`${tag}: no room selected - Rooms table is empty.`);
    return null;
  }

  for (const room of rooms) {
    const label = `room ${room.room_number} (id ${room.room_id})`;

    if (usedRoomIds.has(room.room_id)) {
      console.log(`${tag}: reject ${label} - already used by an earlier scenario in this run.`);
      continue;
    }
    if (room.status !== 'available') {
      console.log(`${tag}: reject ${label} - Rooms.status = '${room.status}' (need 'available').`);
      continue;
    }

    const [conflicts] = await conn.query(
      `SELECT x.reservation_id, x.booking_reference, x.status,
              DATE_FORMAT(x.check_in_date,  '%Y-%m-%d') AS check_in,
              DATE_FORMAT(x.check_out_date, '%Y-%m-%d') AS check_out
         FROM Reservations x
        WHERE x.room_id = ?
          AND x.status IN (?)
          AND x.check_in_date < ? AND x.check_out_date > ?`,
      [room.room_id, LIVE_STATUSES, checkOut, checkIn]
    );
    if (conflicts.length) {
      const detail = conflicts
        .map((c) => `${c.booking_reference || `#${c.reservation_id}`} [${c.status}] ${c.check_in} -> ${c.check_out}`)
        .join('; ');
      console.log(`${tag}: reject ${label} - overlaps live reservation(s): ${detail}`);
      continue;
    }

    console.log(`${tag}: selected ${label}.`);
    return room;
  }

  console.warn(`${tag}: no room selected - every room was rejected (see reasons above).`);
  return null;
}

async function cleanup(conn) {
  const [rows] = await conn.query(
    `SELECT r.reservation_id FROM Reservations r
       JOIN Customer c ON c.customer_id = r.customer_id
      WHERE c.email LIKE ?`,
    [`%${EMAIL_DOMAIN}`]
  );
  const ids = rows.map((r) => r.reservation_id);

  if (ids.length) {
    // Rows created while testing check-out; tables missing on older DBs are skipped.
    const optional = [
      ['Reservation_Inventory_Lines', `DELETE FROM Reservation_Inventory_Lines WHERE check_id IN (SELECT check_id FROM Reservation_Inventory_Checks WHERE reservation_id IN (?))`],
      ['Reservation_Inventory_Checks', `DELETE FROM Reservation_Inventory_Checks WHERE reservation_id IN (?)`],
      ['Reservation_Addons', `DELETE FROM Reservation_Addons WHERE reservation_id IN (?)`],
    ];
    for (const [table, sql] of optional) {
      try {
        await conn.query(sql, [ids]);
      } catch (err) {
        if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
      }
    }
    await conn.query('DELETE FROM Payments WHERE reservation_id IN (?)', [ids]);
    await conn.query('DELETE FROM Reservation_Status_History WHERE reservation_id IN (?)', [ids]);
    await conn.query('DELETE FROM Reservations WHERE reservation_id IN (?)', [ids]);
  }
  const [res] = await conn.query('DELETE FROM Customer WHERE email LIKE ?', [`%${EMAIL_DOMAIN}`]);
  return { reservations: ids.length, customers: res.affectedRows };
}

async function main() {
  if (!process.env.DB_NAME) {
    throw new Error('DB_NAME must be set before seeding checkout test data.');
  }
  const cleanupOnly = process.argv.includes('--cleanup');
  const noShowOnly = process.argv.includes('--no-show');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[dbInfo]] = await conn.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port');
    const [[roomStats]] = await conn.query(`SELECT COUNT(*) AS total, SUM(status = 'available') AS available FROM Rooms`);
    console.log(`Connected to database "${dbInfo.db}" on ${dbInfo.host}:${dbInfo.port} (DB_NAME env: ${process.env.DB_NAME}).`);
    console.log(`Rooms in this database: ${roomStats.total} total, ${roomStats.available || 0} available.`);

    const removed = await cleanup(conn);
    console.log(`Removed previous seed: ${removed.reservations} reservations, ${removed.customers} guests.`);

    if (cleanupOnly) {
      await conn.commit();
      return;
    }

    const scenarios = noShowOnly ? [NO_SHOW_SCENARIO] : SCENARIOS;
    const today = manilaToday();
    const [yyyy, mm] = today.split('-');
    console.log(`Seeding for check-out date ${today} (Asia/Manila).`);

    // Staff actor + cash method.
    const [[staff]] = await conn.query(`SELECT user_id FROM Users WHERE role = 'admin' AND is_active = 1 LIMIT 1`);
    if (!staff) throw new Error('No admin user found. Run createAdmin.js first.');
    const [[cash]] = await conn.query(`SELECT payment_method_id FROM PaymentMethods WHERE method_type = 'cash' LIMIT 1`);
    if (!cash) throw new Error('No cash payment method found. Apply 20261005_add_cash_card_payment_methods.sql.');

    // The controller hides reservations whose guest first_name equals this marker
    // (findReservation / getDisplayReservations). Seeds must not match it.
    if (PLACEHOLDER_CUSTOMER_MARKER && SEED_FIRST_NAME === PLACEHOLDER_CUSTOMER_MARKER) {
      throw new Error(`Seed guest first_name "${SEED_FIRST_NAME}" equals PLACEHOLDER_CUSTOMER_MARKER; staff screens would hide it.`);
    }
    if (Array.isArray(NO_RECEIPT_METHOD_TYPES) && !NO_RECEIPT_METHOD_TYPES.includes('cash')) {
      console.warn("'cash' is not in NO_RECEIPT_METHOD_TYPES; collecting the balance in the UI will demand a receipt photo.");
    }

    const usedRoomIds = new Set(); // rooms already assigned to a scenario in this run
    const seeded = [];
    const skipped = [];

    for (let i = 0; i < scenarios.length; i += 1) {
      const s = scenarios[i];
      const checkOut = s.noShow ? addDays(today, -1) : today;
      const checkIn = addDays(checkOut, -s.nights);

      // One distinct, free, active room per scenario: no overlapping live reservation.
      const room = await pickRoom(conn, s, checkIn, checkOut, usedRoomIds);
      if (!room) {
        console.warn(`Skipping "${s.key}" (${checkIn} -> ${checkOut}).`);
        skipped.push(s.key);
        continue;
      }
      usedRoomIds.add(room.room_id);

      try {
        const [[inv]] = await conn.query('SELECT COUNT(*) AS n FROM room_inventory WHERE room_id = ?', [room.room_id]);
        if (!inv.n) {
          console.warn(`Room ${room.room_number} has no room_inventory rows; its check-out checklist may be empty.`);
        }
      } catch (err) {
        if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
        console.warn('Table room_inventory not found; skipping checklist check.');
      }

      const baseCents = Math.round(Number(room.price_per_night) * 100) * s.nights;
      const depositCents = Math.round((baseCents * DEPOSIT_PERCENTAGE) / 100);
      const paymentCents = {
        deposit: depositCents,
        balance: baseCents - depositCents,
        full: baseCents,
      };

      const [cust] = await conn.query(
        `INSERT INTO Customer (first_name, last_name, email, phone_number, is_registered) VALUES (?, ?, ?, ?, 0)`,
        [SEED_FIRST_NAME, `Seed ${i + 1}`, `seed${i + 1}${EMAIL_DOMAIN}`, `0900000000${i + 1}`]
      );

      const ref = `KAB-${yyyy}-${mm}-${8001 + i}`;
      const [resv] = await conn.query(
        `INSERT INTO Reservations
           (customer_id, room_id, booking_source, booking_reference, created_by,
            check_in_date, check_out_date, num_guests, total_amount,
            actual_check_in, early_checkin_fee, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?, ?, ?)`,
        [
          cust.insertId, room.room_id, s.source, ref,
          s.source === 'walk-in' ? staff.user_id : null,
            checkIn, checkOut, pesos(baseCents),
            s.noShow ? null : `${checkIn} 14:00:00`,
          pesos(s.earlyFeeCents || 0),
            s.noShow ? 'confirmed' : 'checked_in',
        ]
      );
      const reservationId = resv.insertId;

      for (const type of s.payments) {
        await conn.query(
          `INSERT INTO Payments
             (reservation_id, payment_method_id, amount, payment_type, payment_status, verified_by, verified_at)
           VALUES (?, ?, ?, ?, 'verified', ?, NOW())`,
          [reservationId, cash.payment_method_id, pesos(paymentCents[type]), type, staff.user_id]
        );
      }

      // Mirror the real flow: (accept / walk-in create) -> confirmed -> check-in.
      await recordReservationStatusHistory(conn, reservationId, null, 'confirmed', 'staff', staff.user_id, 'Seeded for checkout testing');
      if (!s.noShow) {
        await recordReservationStatusHistory(conn, reservationId, 'confirmed', 'checked_in', 'staff', staff.user_id, 'Seeded for checkout testing');
      }

      const paid = s.payments.reduce((sum, t) => sum + paymentCents[t], 0);
      const balance = baseCents + (s.earlyFeeCents || 0) - paid;
      seeded.push(s.key);
      console.log(`${ref}  room ${room.room_number}  ${checkIn} -> ${checkOut}  balance due PHP ${pesos(balance)}  | ${s.label}`);
    }

    await conn.commit();
    console.log(`\nSeeded ${seeded.length}/${scenarios.length} scenarios: ${seeded.join(', ') || 'none'}.`);
    if (skipped.length) {
      console.warn(`NOT seeded: ${skipped.join(', ')}. See the "reject" lines above for why.`);
      process.exitCode = 2; // partial seed: committed, but flagged
    }
    console.log('Done. Log in as admin/receptionist and open /admin/reservations.');
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