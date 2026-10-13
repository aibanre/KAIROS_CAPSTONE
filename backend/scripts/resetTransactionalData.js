require('dotenv').config();
const readline = require('readline');
const pool = require('../config/db');

const tables = [
  ['Reservation_Inventory_Lines', 'all'],
  ['Reservation_Inventory_Checks', 'all'],
  ['Reservation_Addons', 'all'],
  ['Reservation_Status_History', 'all'],
  ['Payments', 'all'],
  ['Reviews', 'all'],
  ['Chatbot_Messages', 'all'],
  ['Chatbot_Conversations', 'all'],
  ['Audit_logs', 'all'],
  ['Reservations', 'all'],
  ['Customer', 'pilot'],
];

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function resetTransactionalData() {
  const dbName = process.env.DB_NAME || 'kairos_db';
  console.log(`[resetTransactionalData] Target DB_NAME: ${dbName}`);
  if (await ask('Type the DB_NAME exactly to continue: ') !== dbName) {
    throw new Error('Confirmation did not match; nothing was changed.');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const before = {};
    for (const [table] of tables) {
      const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      before[table] = Number(row.count);
    }
    console.log(`[resetTransactionalData] Before: ${JSON.stringify(before)}`);
    for (const [table, scope] of tables) {
      if (scope === 'pilot') {
        await connection.query(`DELETE FROM \`${table}\` WHERE email LIKE '%@pilot.invalid'`);
      } else {
        await connection.query(`DELETE FROM \`${table}\``);
      }
    }
    const after = {};
    for (const [table] of tables) {
      const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      after[table] = Number(row.count);
    }
    await connection.commit();
    console.log(`[resetTransactionalData] After: ${JSON.stringify(after)}`);
    console.log('[resetTransactionalData] Users, Rooms, Venues, Venue_Packages, PaymentMethods, and ResortSettings were not touched.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

resetTransactionalData().catch((error) => {
  console.error(`[resetTransactionalData] Failed: ${error.message}`);
  process.exitCode = 1;
});
