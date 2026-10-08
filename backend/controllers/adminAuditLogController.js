const pool = require('../config/db');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const SENSITIVE_KEY = /(password|password_hash|token|secret)/i;

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSensitive(nestedValue),
  ]));
}

function parseAuditValue(value) {
  if (value === null || value === undefined || value === '') return null;
  try {
    return redactSensitive(JSON.parse(value));
  } catch {
    return redactSensitive(value);
  }
}

function normalizeAuditLog(log) {
  return {
    ...log,
    entity_type: log.entity_type ? String(log.entity_type).toLowerCase() : null,
    old_value: parseAuditValue(log.old_value),
    new_value: parseAuditValue(log.new_value),
    user_name: log.user_name || 'System',
    user_role: log.user_role || null,
  };
}

async function getAuditLogs(req, res) {
  const page = parsePositiveInteger(req.query.page, 1);
  const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);
  const userId = req.query.user_id === undefined || req.query.user_id === ''
    ? null
    : parsePositiveInteger(req.query.user_id, null);
  const from = req.query.from ? parseDate(req.query.from) : null;
  const to = req.query.to ? parseDate(req.query.to) : null;

  if (!page || !limit || (req.query.user_id !== undefined && userId === null)) {
    return res.status(400).json({ error: 'page, limit, and user_id must be positive integers.' });
  }
  if ((req.query.from && !from) || (req.query.to && !to)) {
    return res.status(400).json({ error: 'from and to must be valid dates in YYYY-MM-DD format.' });
  }
  if (from && to && from > to) {
    return res.status(400).json({ error: 'from must be on or before to.' });
  }

  const safeLimit = Math.min(limit, MAX_LIMIT);
  const offset = (page - 1) * safeLimit;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
  const entityType = typeof req.query.entity_type === 'string' ? req.query.entity_type.trim().toLowerCase() : '';
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push(`(
      al.action LIKE ? OR LOWER(COALESCE(al.entity_type, '')) LIKE ? OR CAST(al.entity_id AS CHAR) LIKE ?
      OR LOWER(COALESCE(u.full_name, u.username, '')) LIKE ?
    )`);
    const searchValue = `%${search}%`;
    params.push(searchValue, searchValue.toLowerCase(), searchValue, searchValue.toLowerCase());
  }
  if (action) {
    conditions.push('al.action = ?');
    params.push(action);
  }
  if (entityType) {
    conditions.push('LOWER(al.entity_type) = ?');
    params.push(entityType);
  }
  if (userId !== null) {
    conditions.push('al.user_id = ?');
    params.push(userId);
  }
  if (from) {
    conditions.push('al.created_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    conditions.push('al.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(`${to} 00:00:00`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const baseQuery = `
    FROM Audit_logs al
    LEFT JOIN Users u ON al.user_id = u.user_id
    ${where}`;

  try {
    const [[countRow], [logs], [actions], [entityTypes]] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${baseQuery}`, params),
      pool.query(
        `SELECT al.log_id, al.user_id, al.action, LOWER(al.entity_type) AS entity_type,
                al.entity_id, al.old_value, al.new_value, al.ip_address, al.created_at,
                COALESCE(u.full_name, u.username) AS user_name, u.role AS user_role
         ${baseQuery}
         ORDER BY al.created_at DESC, al.log_id DESC
         LIMIT ? OFFSET ?`,
        [...params, safeLimit, offset]
      ),
      pool.query(`SELECT DISTINCT action FROM Audit_logs WHERE action IS NOT NULL ORDER BY action ASC`),
      pool.query(`SELECT DISTINCT LOWER(entity_type) AS entity_type FROM Audit_logs WHERE entity_type IS NOT NULL ORDER BY entity_type ASC`),
    ]);

    const total = Number(countRow[0].total);
    return res.status(200).json({
      page,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
      logs: logs.map(normalizeAuditLog),
      filterOptions: {
        actions: actions.map((row) => row.action),
        entityTypes: entityTypes.map((row) => row.entity_type),
      },
    });
  } catch (err) {
    console.error('[getAuditLogs] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
}

module.exports = { getAuditLogs };
