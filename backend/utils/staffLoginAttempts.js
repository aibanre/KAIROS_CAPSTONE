const crypto = require('crypto');
const pool = require('../config/db');

const FAILURE_THRESHOLD = 5;
const BASE_COOLDOWN_MINUTES = 15;
const MAX_COOLDOWN_MINUTES = 60;
const RETENTION_DAYS = 30;
let lastPrunedAt = 0;

function hashEmail(email) {
  return crypto.createHash('sha256').update(email).digest('hex');
}

async function pruneExpiredAttempts() {
  const now = Date.now();
  if (now - lastPrunedAt < 60 * 60 * 1000) return;
  lastPrunedAt = now;
  try {
    await pool.query(
      'DELETE FROM Login_Attempts WHERE updated_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)',
      [RETENTION_DAYS]
    );
  } catch (err) {
    console.error('[staffLoginAttempts] Cleanup failed:', err.message);
  }
}

async function getActiveCooldown(emailHash) {
  await pruneExpiredAttempts();
  const [rows] = await pool.query(
    `SELECT account_user_id, locked_until,
            GREATEST(1, TIMESTAMPDIFF(SECOND, CURRENT_TIMESTAMP, locked_until)) AS retry_after
     FROM Login_Attempts
     WHERE email_hash = ? AND locked_until > CURRENT_TIMESTAMP
     LIMIT 1`,
    [emailHash]
  );
  if (!rows[0]) return null;
  return {
    userId: rows[0].account_user_id,
    retryAfter: Number(rows[0].retry_after),
  };
}

async function recordFailedAttempt(emailHash, userId) {
  await pruneExpiredAttempts();
  await pool.query(
    `INSERT INTO Login_Attempts
      (email_hash, account_user_id, failed_attempts, cooldown_level, locked_until)
     VALUES (?, ?, 1, 0, NULL)
     ON DUPLICATE KEY UPDATE
       locked_until = IF(
         MOD(failed_attempts + 1, ? ) = 0,
         DATE_ADD(CURRENT_TIMESTAMP, INTERVAL LEAST(?, ? * POW(2, cooldown_level)) MINUTE),
         locked_until
       ),
       cooldown_level = IF(
         MOD(failed_attempts + 1, ? ) = 0,
         LEAST(cooldown_level + 1, 10),
         cooldown_level
       ),
       account_user_id = COALESCE(VALUES(account_user_id), account_user_id),
       failed_attempts = failed_attempts + 1,
       updated_at = CURRENT_TIMESTAMP`,
    [
      emailHash,
      userId,
      FAILURE_THRESHOLD,
      MAX_COOLDOWN_MINUTES,
      BASE_COOLDOWN_MINUTES,
      FAILURE_THRESHOLD,
    ]
  );
}

async function resetFailedAttempts(emailHash) {
  await pool.query('DELETE FROM Login_Attempts WHERE email_hash = ?', [emailHash]);
}

module.exports = {
  FAILURE_THRESHOLD,
  hashEmail,
  getActiveCooldown,
  recordFailedAttempt,
  resetFailedAttempts,
};
