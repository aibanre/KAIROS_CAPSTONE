const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');

const SALT_ROUNDS = 12;
const STAFF_ROLES = ['admin', 'receptionist'];
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';

function getIpAddress(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
}

function generateTemporaryPassword() {
  const required = ['A', 'a', '2', '!'];
  const randomCharacters = Array.from(crypto.randomBytes(8), (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);
  return [...required, ...randomCharacters].sort(() => crypto.randomInt(0, 2) - 0.5).join('');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getAllUsers(req, res) {
  try {
    const [users] = await pool.query(
      `SELECT user_id, username, email, full_name, role, status, created_at, last_login
       FROM Users ORDER BY full_name ASC, username ASC`
    );
    return res.status(200).json({ count: users.length, users });
  } catch (err) {
    console.error('[getAllUsers] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch staff accounts.' });
  }
}

async function createUser(req, res) {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
  const { role } = req.body;

  if (!username || !email || !fullName || !role) {
    return res.status(400).json({ error: 'username, email, full_name, and role are required.' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please provide a valid email address.' });
  if (!STAFF_ROLES.includes(role)) return res.status(400).json({ error: 'role must be admin or receptionist.' });

  try {
    const [existing] = await pool.query(
      'SELECT user_id, username, email FROM Users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.some((user) => user.username === username)) {
      return res.status(409).json({ error: `Username "${username}" already exists.` });
    }
    if (existing.some((user) => user.email === email)) {
      return res.status(409).json({ error: `Email "${email}" already exists.` });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
    const [result] = await pool.query(
      `INSERT INTO Users (username, password_hash, email, full_name, role, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [username, passwordHash, email, fullName, role]
    );
    const [created] = await pool.query(
      `SELECT user_id, username, email, full_name, role, status, created_at, last_login
       FROM Users WHERE user_id = ?`,
      [result.insertId]
    );

    await logAudit({
      userId: req.user.user_id,
      action: ACTIONS.USER_CREATE,
      entityType: ENTITY_TYPES.USER,
      entityId: result.insertId,
      newValue: created[0],
      ipAddress: getIpAddress(req),
    });

    return res.status(201).json({
      message: 'Staff account created successfully.',
      user: created[0],
      temporary_password: temporaryPassword,
    });
  } catch (err) {
    console.error('[createUser] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create staff account.' });
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { username } = req.body;
  const requestedFields = ['full_name', 'email', 'role'].filter((field) => req.body[field] !== undefined);

  if (username !== undefined) {
    return res.status(400).json({ error: 'username is immutable and cannot be changed.' });
  }
  if (requestedFields.length === 0) return res.status(400).json({ error: 'No editable fields were provided.' });

  try {
    const [existing] = await pool.query(
      `SELECT user_id, username, email, full_name, role, status, created_at, last_login
       FROM Users WHERE user_id = ?`,
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Staff account not found.' });

    const current = existing[0];
    const fullName = req.body.full_name === undefined ? current.full_name : String(req.body.full_name).trim();
    const email = req.body.email === undefined ? current.email : String(req.body.email).trim().toLowerCase();
    const role = req.body.role === undefined ? current.role : req.body.role;
    if (!fullName || !email) return res.status(400).json({ error: 'full_name and email cannot be empty.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Please provide a valid email address.' });
    if (!STAFF_ROLES.includes(role)) return res.status(400).json({ error: 'role must be admin or receptionist.' });

    if (email !== current.email) {
      const [duplicate] = await pool.query('SELECT user_id FROM Users WHERE email = ? AND user_id != ?', [email, id]);
      if (duplicate.length > 0) return res.status(409).json({ error: `Email "${email}" already exists.` });
    }

    await pool.query(
      `UPDATE Users SET full_name = ?, email = ?, role = ? WHERE user_id = ?`,
      [fullName, email, role, id]
    );
    const updated = { ...current, full_name: fullName, email, role };
    await logAudit({
      userId: req.user.user_id,
      action: ACTIONS.USER_UPDATE,
      entityType: ENTITY_TYPES.USER,
      entityId: id,
      oldValue: current,
      newValue: updated,
      ipAddress: getIpAddress(req),
    });
    return res.status(200).json({ message: 'Staff account updated successfully.', user: updated });
  } catch (err) {
    console.error('[updateUser] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update staff account.' });
  }
}

async function changeUserStatus(req, res, status) {
  const { id } = req.params;
  try {
    const [existing] = await pool.query(
      'SELECT user_id, username, email, full_name, role, status, created_at, last_login FROM Users WHERE user_id = ?',
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Staff account not found.' });
    if (status === 'inactive' && String(id) === String(req.user.user_id)) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    await pool.query('UPDATE Users SET status = ? WHERE user_id = ?', [status, id]);
    const updated = { ...existing[0], status };
    await logAudit({
      userId: req.user.user_id,
      action: status === 'inactive' ? ACTIONS.USER_DEACTIVATE : ACTIONS.USER_REACTIVATE,
      entityType: ENTITY_TYPES.USER,
      entityId: id,
      oldValue: { status: existing[0].status },
      newValue: { status },
      ipAddress: getIpAddress(req),
    });
    return res.status(200).json({ message: `Staff account ${status === 'inactive' ? 'deactivated' : 'reactivated'} successfully.`, user: updated });
  } catch (err) {
    console.error(`[${status === 'inactive' ? 'deactivateUser' : 'reactivateUser'}] Error:`, err.message);
    return res.status(500).json({ error: `Failed to ${status === 'inactive' ? 'deactivate' : 'reactivate'} staff account.` });
  }
}

const deactivateUser = (req, res) => changeUserStatus(req, res, 'inactive');
const reactivateUser = (req, res) => changeUserStatus(req, res, 'active');

module.exports = { getAllUsers, createUser, updateUser, deactivateUser, reactivateUser };