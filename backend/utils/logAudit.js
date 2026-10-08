const pool = require('../config/db');

const MAX_AUDIT_VALUE_LENGTH = 60000;
const SENSITIVE_KEY = /(password|password_hash|token|secret)/i;

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSensitive(nestedValue),
  ]));
}

function serializeValue(value) {
  if (value === undefined || value === null) {
    return value ?? null;
  }

  let serialized;
  if (typeof value === 'string') {
    try {
      serialized = JSON.stringify(redactSensitive(JSON.parse(value)));
    } catch {
      serialized = value;
    }
  } else {
    serialized = JSON.stringify(redactSensitive(value));
  }

  return serialized.length > MAX_AUDIT_VALUE_LENGTH
    ? `${serialized.slice(0, MAX_AUDIT_VALUE_LENGTH - 14)}...[truncated]`
    : serialized;
}

async function logAudit({ userId, action, entityType, entityId, oldValue, newValue, ipAddress, connection }) {
  const executor = connection || pool;
  await executor.query(
    `INSERT INTO Audit_logs
      (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      action,
      entityType ?? null,
      entityId ?? null,
      serializeValue(oldValue),
      serializeValue(newValue),
      ipAddress ?? null,
    ]
  );
}

module.exports = logAudit;