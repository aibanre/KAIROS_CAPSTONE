require('dotenv').config();

const pool = require('../config/db');

const DEFAULT_EMAIL = 'ivanrocat13@gmail.com';
const DEFAULT_COUNT = 3;
const MAX_COUNT = 10;
const SEED_ACTION = 'dev_seed_completed_stay';
const REFERENCE_SUFFIX = '9';

function usage() {
  console.log('Usage: node backend/scripts/seedCompletedStays.js [email] [--count=3] [--no-payments]');
  console.log('       node backend/scripts/seedCompletedStays.js --cleanup [email]');
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--') && !arg.startsWith('--count=')));
  const countArg = argv.find((arg) => arg.startsWith('--count='));
  const count = countArg ? Number(countArg.slice('--count='.length)) : DEFAULT_COUNT;
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const cleanup = flags.has('--cleanup');
  const email = (cleanup ? positional[0] : positional[0]) || DEFAULT_EMAIL;
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`--count must be an integer from 1 to ${MAX_COUNT}.`);
  }
  return { cleanup, email: email.trim().toLowerCase(), count, noPayments: flags.has('--no-payments') };
}

function manilaDateDaysAgo(daysAgo) {
  const now = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateTime(date, time) {
  return `${date} ${time}`;
}

function seedReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const suffix = `${REFERENCE_SUFFIX}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  return `KAB-${year}-${month}-${suffix}`;
}

async function hasTable(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function uniqueReference(connection) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const reference = seedReference();
    const [rows] = await connection.query(
      'SELECT reservation_id FROM Reservations WHERE booking_reference = ? LIMIT 1',
      [reference]
    );
    if (!rows.length) return reference;
  }
  throw new Error('Could not generate a unique seeded booking reference.');
}

async function findPaymentMethod(connection) {
  const [cashRows] = await connection.query(
    `SELECT payment_method_id, method_type
     FROM PaymentMethods
     WHERE is_active = TRUE AND LOWER(method_type) = 'cash'
     ORDER BY payment_method_id ASC LIMIT 1`
  );
  if (cashRows[0]) return cashRows[0];
  const [activeRows] = await connection.query(
    `SELECT payment_method_id, method_type
     FROM PaymentMethods
     WHERE is_active = TRUE
     ORDER BY payment_method_id ASC LIMIT 1`
  );
  return activeRows[0] || null;
}

function printSummary(rows) {
  if (!rows.length) {
    console.log('No new stays were seeded.');
    return;
  }
  console.table(rows.map((row) => ({
    reference: row.booking_reference,
    room: row.room_number,
    check_in: row.check_in_date,
    check_out: row.check_out_date,
    total: Number(row.total_amount),
  })));
}

async function seedStays({ email, count, noPayments }) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed completed stays while NODE_ENV=production.');
  }

  const connection = await pool.getConnection();
  try {
    const [customers] = await connection.query(
      'SELECT customer_id, email FROM Customer WHERE email = ? LIMIT 1',
      [email]
    );
    if (!customers.length) {
      console.log(`No customer found for ${email}. Log in or register with this email once, then run the seed again.`);
      return;
    }

    const [rooms] = await connection.query(
      `SELECT room_id, room_number, capacity, price_per_night
       FROM Rooms
       WHERE status = 'available'
       ORDER BY room_id ASC
       LIMIT ?`,
      [count]
    );
    if (!rooms.length) {
      console.log('No active rooms are available for seeding completed stays.');
      return;
    }

    const paymentMethod = noPayments ? null : await findPaymentMethod(connection);
    if (!noPayments && !paymentMethod) {
      throw new Error('No active payment method exists. Use --no-payments or activate a payment method first.');
    }
    const actualCheckInAvailable = await hasColumn(connection, 'Reservations', 'actual_check_in');
    const actualCheckOutAvailable = await hasColumn(connection, 'Reservations', 'actual_check_out');
    const childrenAvailable = await hasColumn(connection, 'Reservations', 'children');
    const statusHistoryAvailable = await hasTable(connection, 'Reservation_Status_History');
    const auditAvailable = await hasTable(connection, 'Audit_logs');
    const customer = customers[0];
    const seeded = [];
    const skipped = [];

    for (let index = 0; index < rooms.length && seeded.length < count; index += 1) {
      const room = rooms[index];
      const checkInDate = manilaDateDaysAgo(14 + index * 16);
      const nights = (index % 3) + 1;
      const checkOutDate = addDays(checkInDate, nights);
      const [existing] = await connection.query(
        `SELECT reservation_id, booking_reference, check_in_date, check_out_date, total_amount, room_number
         FROM Reservations r INNER JOIN Rooms rm ON rm.room_id = r.room_id
         WHERE r.customer_id = ? AND r.room_id = ? AND r.check_in_date = ?
           AND r.check_out_date = ? AND r.booking_reference LIKE ?
         LIMIT 1`,
        [customer.customer_id, room.room_id, checkInDate, checkOutDate, 'KAB-%-9___']
      );
      if (existing[0]) {
        skipped.push(existing[0]);
        continue;
      }

      await connection.beginTransaction();
      try {
        const reference = await uniqueReference(connection);
        const totalAmount = Number(room.price_per_night) * nights;
        const columns = [
          'customer_id', 'room_id', 'booking_source', 'booking_reference',
          'check_in_date', 'check_out_date', 'num_guests',
          'total_amount', 'status',
        ];
        const values = [
          customer.customer_id, room.room_id, 'online', reference,
          checkInDate, checkOutDate, Math.max(1, Math.min(Number(room.capacity) || 1, 2)),
          totalAmount, 'completed',
        ];
        if (childrenAvailable) {
          columns.splice(7, 0, 'children');
          values.splice(7, 0, 0);
        }
        if (actualCheckInAvailable) {
          columns.push('actual_check_in');
          values.push(dateTime(checkInDate, '14:00:00'));
        }
        if (actualCheckOutAvailable) {
          columns.push('actual_check_out');
          values.push(dateTime(checkOutDate, '12:00:00'));
        }
        columns.push('early_checkin_fee', 'late_checkout_fee');
        values.push(0, 0);
        const placeholders = columns.map(() => '?').join(', ');
        const [reservationResult] = await connection.query(
          `INSERT INTO Reservations (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
        const reservationId = reservationResult.insertId;

        if (!noPayments) {
          await connection.query(
            `INSERT INTO Payments
              (reservation_id, amount, payment_type, payment_method_id, proof_of_payment_url, payment_status, verified_at)
             VALUES (?, ?, 'full', ?, NULL, 'verified', ?)`,
            [reservationId, totalAmount, paymentMethod.payment_method_id, dateTime(checkInDate, '14:00:00')]
          );
        }
        if (statusHistoryAvailable) {
          const historyColumns = await hasColumn(connection, 'Reservation_Status_History', 'actor_type')
            ? '(reservation_id, from_status, to_status, actor_type, reason)'
            : '(reservation_id, from_status, to_status, change_source, reason)';
          await connection.query(
            `INSERT INTO Reservation_Status_History ${historyColumns} VALUES (?, NULL, 'completed', 'system', ?)`,
            [reservationId, 'Development seed completed stay']
          );
        }
        if (auditAvailable) {
          await connection.query(
            `INSERT INTO Audit_logs
              (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
             VALUES (NULL, ?, 'reservation', ?, NULL, ?, NULL)`,
            [SEED_ACTION, reservationId, JSON.stringify({
              booking_reference: reference,
              customer_id: customer.customer_id,
              room_id: room.room_id,
              seeded: true,
            })]
          );
        }
        await connection.commit();
        seeded.push({
          booking_reference: reference,
          room_number: room.room_number,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          total_amount: totalAmount,
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }

    console.log(`Seeded completed stays for ${email}.`);
    printSummary(seeded);
    if (skipped.length) console.log(`Skipped ${skipped.length} existing seeded stay(s); the seed is idempotent.`);
    console.log(`Payment rows: ${noPayments ? 'skipped (--no-payments)' : 'verified full payments inserted'}.`);
    console.log('Review eligibility: completed reservation, same authenticated customer, and no existing review.');
    console.log('Write reviews from My Reviews or the completed reservation details page.');
  } finally {
    connection.release();
  }
}

async function cleanup({ email }) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to clean seeded completed stays while NODE_ENV=production.');
  }
  const connection = await pool.getConnection();
  try {
    const [customers] = await connection.query('SELECT customer_id FROM Customer WHERE email = ? LIMIT 1', [email]);
    if (!customers.length) {
      console.log(`No customer found for ${email}; nothing to clean.`);
      return;
    }
    const customerId = customers[0].customer_id;
    await connection.beginTransaction();
    try {
      const [rows] = await connection.query(
        `SELECT r.reservation_id, r.booking_reference
         FROM Reservations r
         INNER JOIN Audit_logs a ON a.entity_id = r.reservation_id
           AND a.entity_type = 'reservation' AND a.action = ?
         WHERE r.customer_id = ? AND r.booking_reference REGEXP '^KAB-[0-9]{4}-[0-9]{2}-9[0-9]{3}$'
         GROUP BY r.reservation_id, r.booking_reference`,
        [SEED_ACTION, customerId]
      );
      if (!rows.length) {
        await connection.rollback();
        console.log(`No seeded completed stays found for ${email}; nothing to clean.`);
        return;
      }
      const ids = rows.map((row) => row.reservation_id);
      const placeholders = ids.map(() => '?').join(', ');
      const [reviews] = await connection.query(`DELETE FROM Reviews WHERE reservation_id IN (${placeholders})`, ids);
      const [payments] = await connection.query(`DELETE FROM Payments WHERE reservation_id IN (${placeholders})`, ids);
      let historyCount = 0;
      if (await hasTable(connection, 'Reservation_Status_History')) {
        const [history] = await connection.query(`DELETE FROM Reservation_Status_History WHERE reservation_id IN (${placeholders})`, ids);
        historyCount = history.affectedRows;
      }
      const [audit] = await connection.query(
        `DELETE FROM Audit_logs WHERE action = ? AND entity_id IN (${placeholders})`,
        [SEED_ACTION, ...ids]
      );
      const [reservations] = await connection.query(`DELETE FROM Reservations WHERE reservation_id IN (${placeholders})`, ids);
      await connection.commit();
      console.log(`Cleaned ${reservations.affectedRows} seeded reservation(s) for ${email}.`);
      console.log(`Removed reviews=${reviews.affectedRows}, payments=${payments.affectedRows}, status_history=${historyCount}, audit_logs=${audit.affectedRows}.`);
      console.table(rows);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    connection.release();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.cleanup) await cleanup(options);
  else await seedStays(options);
}

main()
  .catch((error) => {
    console.error(`[seedCompletedStays] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
