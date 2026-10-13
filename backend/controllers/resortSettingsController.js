const pool = require('../config/db');
const { DEFAULT_RESORT_INFO } = require('../config/resortInfo');
const logAudit = require('../utils/logAudit');

const RESORT_FIELDS = ['resort_name', 'address', 'contact_number', 'email'];
const FIELD_LIMITS = {
  resort_name: 150,
  address: 255,
  contact_number: 30,
  email: 150,
};
const CONTACT_PATTERN = /^[\d\s+\-()]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicResortInfo(row = DEFAULT_RESORT_INFO) {
  return RESORT_FIELDS.reduce((result, field) => {
    result[field] = row[field];
    return result;
  }, {});
}

function isMissingTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_TABLEACCESS_DENIED_ERROR';
}

function validateResortInfo(body) {
  const fields = {};
  const values = {};

  RESORT_FIELDS.forEach((field) => {
    const value = typeof body?.[field] === 'string' ? body[field].trim() : '';
    values[field] = value;
    if (!value) fields[field] = 'This field is required.';
    else if (value.length > FIELD_LIMITS[field]) fields[field] = `Must be ${FIELD_LIMITS[field]} characters or fewer.`;
  });

  if (values.email && !EMAIL_PATTERN.test(values.email)) fields.email = 'Enter a valid email address.';
  const digitCount = (values.contact_number.match(/\d/g) || []).length;
  if (values.contact_number && (!CONTACT_PATTERN.test(values.contact_number) || digitCount < 7)) {
    fields.contact_number = 'Enter a valid contact number.';
  }

  return { values, fields };
}

async function getResortInfo(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT resort_name, address, contact_number, email FROM ResortSettings WHERE settings_id = 1 LIMIT 1'
    );
    return res.status(200).set('Cache-Control', 'public, max-age=60').json(publicResortInfo(rows[0] || DEFAULT_RESORT_INFO));
  } catch (error) {
    if (!isMissingTableError(error)) console.error('[getResortInfo] Error:', error.message);
    return res.status(200).set('Cache-Control', 'public, max-age=60').json(DEFAULT_RESORT_INFO);
  }
}

async function getAdminResortInfo(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT resort_name, address, contact_number, email FROM ResortSettings WHERE settings_id = 1 LIMIT 1'
    );
    return res.status(200).json(publicResortInfo(rows[0] || DEFAULT_RESORT_INFO));
  } catch (error) {
    if (isMissingTableError(error)) return res.status(200).json(DEFAULT_RESORT_INFO);
    console.error('[getAdminResortInfo] Error:', error.message);
    return res.status(500).json({ error: 'Unable to load resort information.' });
  }
}

async function loadResortInfo() {
  try {
    const [rows] = await pool.query(
      'SELECT resort_name, address, contact_number, email FROM ResortSettings WHERE settings_id = 1 LIMIT 1'
    );
    return publicResortInfo(rows[0] || DEFAULT_RESORT_INFO);
  } catch (error) {
    if (!isMissingTableError(error)) console.error('[loadResortInfo] Error:', error.message);
    return DEFAULT_RESORT_INFO;
  }
}

async function updateResortInfo(req, res) {
  const { values, fields } = validateResortInfo(req.body);
  if (Object.keys(fields).length > 0) {
    return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      'SELECT resort_name, address, contact_number, email FROM ResortSettings WHERE settings_id = 1 FOR UPDATE'
    );
    const previous = existingRows[0] ? publicResortInfo(existingRows[0]) : DEFAULT_RESORT_INFO;
    await connection.query(
      `INSERT INTO ResortSettings
        (settings_id, resort_name, address, contact_number, email, updated_by)
       VALUES (1, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        resort_name = VALUES(resort_name),
        address = VALUES(address),
        contact_number = VALUES(contact_number),
        email = VALUES(email),
        updated_by = VALUES(updated_by)`,
      [values.resort_name, values.address, values.contact_number, values.email, req.user.user_id]
    );
    await logAudit({
      userId: req.user.user_id,
      action: 'resort_settings_updated',
      entityType: 'resort_settings',
      entityId: 1,
      oldValue: { ...previous, actor_role: req.user.role },
      newValue: { ...values, actor_role: req.user.role },
      ipAddress: req.ip,
      connection,
    });
    await connection.commit();
    return res.status(200).json(publicResortInfo(values));
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (isMissingTableError(error)) return res.status(503).json({ error: 'Resort information is temporarily unavailable.' });
    console.error('[updateResortInfo] Error:', error.message);
    return res.status(500).json({ error: 'Unable to save resort information.' });
  } finally {
    connection?.release();
  }
}

module.exports = { getResortInfo, getAdminResortInfo, loadResortInfo, updateResortInfo };
