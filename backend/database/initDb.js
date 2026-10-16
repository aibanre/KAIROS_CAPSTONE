// database/initDb.js
// Runs on server startup. Creates the database + all tables if they
// don't already exist. Safe to run every time the app starts.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getMysqlSslOptions } = require('../config/mysqlSsl');

async function initDb() {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    throw new Error('[initDb] DB_NAME must be set to the target database.');
  }
  if (!/^[A-Za-z0-9_$]+$/.test(databaseName)) {
    throw new Error('[initDb] DB_NAME contains unsupported characters.');
  }
  const quotedDatabaseName = `\`${databaseName}\``;

  // Connect WITHOUT selecting a database yet, since the database
  // itself might not exist on first run.
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true,
    ssl: getMysqlSslOptions(),
  });

  try {
    console.log('[initDb] Checking / creating schema...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    if (process.env.NODE_ENV !== 'production') {
      await connection.query(`CREATE DATABASE IF NOT EXISTS ${quotedDatabaseName}`);
    }
    await connection.query(`USE ${quotedDatabaseName}`);
    await connection.query(schemaSql);

    console.log('[initDb] Tables verified/created.');

    await ensureReservationChildrenColumn(connection, databaseName);
    await ensureIndexes(connection, databaseName);
    await ensureTestData(connection);

    console.log('[initDb] Schema is ready.');
  } catch (err) {
    console.error('[initDb] Failed to initialize schema:', err.message);
    throw err; // let the caller decide whether to crash the app
  } finally {
    await connection.end();
  }
}

async function ensureReservationChildrenColumn(connection, databaseName) {
  const [columns] = await connection.query(
    `SELECT COUNT(1) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Reservations' AND COLUMN_NAME = 'children'`,
    [databaseName]
  );

  if (columns[0].cnt === 0) {
    console.log('[initDb] Adding missing Reservations.children column...');
    await connection.query(
      'ALTER TABLE Reservations ADD COLUMN children INT NOT NULL DEFAULT 0 AFTER num_guests'
    );
  }
}

async function ensureTestData(connection) {
  await connection.query(
    `INSERT INTO Rooms
      (room_number, room_type, capacity, price_per_night, description, amenities, status)
     SELECT ?, ?, ?, ?, ?, ?, 'available'
     WHERE NOT EXISTS (
       SELECT 1 FROM Rooms WHERE room_number = ?
     )`,
    [
      'TEST-101',
      'Test Garden Room',
      2,
      3500,
      'A sample room for testing availability and reservation flows.',
      'WiFi, Air Conditioning, Mini Bar',
      'TEST-101',
    ]
  );

  console.log('[initDb] Test room verified.');
}

// MySQL/MariaDB don't support "CREATE INDEX IF NOT EXISTS" consistently,
// so we check information_schema first and only create what's missing.
async function ensureIndexes(connection, databaseName) {
  const indexes = [
    {
      name: 'idx_room_dates',
      table: 'Reservations',
      columns: '(room_id, check_in_date, check_out_date, status)',
    },
    {
      name: 'idx_res_venue_date',
      table: 'Reservations',
      columns: '(venue_id, event_date, start_time)',
    },
    {
      name: 'idx_reservations_customer_created',
      table: 'Reservations',
      columns: '(customer_id, created_at)',
    },
    {
      name: 'idx_reservations_customer_status',
      table: 'Reservations',
      columns: '(customer_id, status)',
    },
    {
      name: 'idx_payments_customer_lookup',
      table: 'Payments',
      columns: '(reservation_id, created_at)',
    },
  ];

  for (const idx of indexes) {
    const [rows] = await connection.query(
      `SELECT COUNT(1) AS cnt
       FROM information_schema.STATISTICS
       WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
      [databaseName, idx.table, idx.name]
    );

    if (rows[0].cnt === 0) {
      console.log(`[initDb] Creating missing index ${idx.name}...`);
      await connection.query(
        `CREATE INDEX ${idx.name} ON ${idx.table} ${idx.columns}`
      );
    }
  }
}

module.exports = initDb;
