// config/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

// XAMPP defaults: root user, no password, port 3306.
// Override any of these via a .env file for other environments.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kairos_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true, // required so initDb.js can run the whole schema.sql in one call
});

module.exports = pool;
