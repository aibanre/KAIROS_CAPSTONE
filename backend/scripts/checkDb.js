require('dotenv').config();
const pool = require('../config/db');

pool.query('SELECT DATABASE() AS db, @@hostname AS host, NOW() AS now')
  .then(([[row]]) => { console.log('Connected:', row); process.exit(0); })
  .catch((err) => { console.error('Connection failed:', err.code, err.message); process.exit(1); });