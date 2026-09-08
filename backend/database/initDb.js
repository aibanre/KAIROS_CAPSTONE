// database/initDb.js
// Runs on server startup. Creates the database + all tables if they
// don't already exist. Safe to run every time the app starts.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function initDb() {
  // Connect WITHOUT selecting a database yet, since the database
  // itself might not exist on first run.
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true,
  });

  try {
    console.log('[initDb] Checking / creating schema...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Runs CREATE DATABASE IF NOT EXISTS + all CREATE TABLE IF NOT EXISTS
    // statements from schema.sql in one go.
    await connection.query(schemaSql);

    console.log('[initDb] Tables verified/created.');

    // Switch to the database for the index step below.
    await connection.query(`USE ${process.env.DB_NAME || 'kairos_db'}`);

    await ensureIndexes(connection);
    await ensureTestData(connection);

    console.log('[initDb] Schema is ready.');
  } catch (err) {
    console.error('[initDb] Failed to initialize schema:', err.message);
    throw err; // let the caller decide whether to crash the app
  } finally {
    await connection.end();
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

  await connection.query(
    `INSERT INTO Venues
      (venue_name, venue_type, capacity, description, amenities, status)
     SELECT ?, ?, ?, ?, ?, 'available'
     WHERE NOT EXISTS (
       SELECT 1 FROM Venues WHERE venue_name = ? AND venue_type = ?
     )`,
    [
      'Test Sunset Pavilion',
      'Test Event Venue',
      50,
      'A sample venue for testing venue browsing and reservation flows.',
      'WiFi, Sound System, Outdoor Seating',
      'Test Sunset Pavilion',
      'Test Event Venue',
    ]
  );

  console.log('[initDb] Test room and venue verified.');
}

// MySQL/MariaDB don't support "CREATE INDEX IF NOT EXISTS" consistently,
// so we check information_schema first and only create what's missing.
async function ensureIndexes(connection) {
  const indexes = [
    {
      name: 'idx_room_dates',
      table: 'Reservations',
      columns: '(room_id, check_in_date, check_out_date, status)',
    },
    {
      name: 'idx_venue_date',
      table: 'Reservations',
      columns: '(venue_id, event_date, status)',
    },
  ];

  for (const idx of indexes) {
    const [rows] = await connection.query(
      `SELECT COUNT(1) AS cnt
       FROM information_schema.STATISTICS
       WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
      [process.env.DB_NAME || 'kairos_db', idx.table, idx.name]
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
