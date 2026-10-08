const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { cookieOptions } = require('../config/security');

const SALT_ROUNDS = 12;
const COOKIE_NAME = 'kairos_auth';
function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return process.env.JWT_SECRET;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
  return {
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
  };
}

async function writeAuthAudit({ action, userId = null, newValue }) {
  try {
    await logAudit({ userId, action, entityType: ENTITY_TYPES.USER_SESSION, newValue });
  } catch (err) {
    console.error('[writeAuthAudit] Error:', err.message);
  }
}

async function registerCustomer(req, res) {
  const { firstName, lastName, email, phone, password } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!firstName?.trim() || !lastName?.trim() || !normalizedEmail || !phone?.trim() || !password) {
    return res.status(400).json({ error: 'First name, last name, email, phone, and password are required.' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  try {
    const [existingCustomers] = await pool.query(
      'SELECT customer_id FROM Customer WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existingCustomers.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      `INSERT INTO Customer (first_name, last_name, email, phone_number, password_hash, is_registered)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [firstName.trim(), lastName.trim(), normalizedEmail, phone.trim(), passwordHash]
    );

    return res.status(201).json({
      message: 'Customer account created successfully.',
      user: {
        user_id: result.insertId,
        email: normalizedEmail,
        role: 'customer',
        full_name: `${firstName.trim()} ${lastName.trim()}`,
      },
    });
  } catch (err) {
    console.error('[registerCustomer] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create customer account.' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail || !password) {
    await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, newValue: { email: normalizedEmail || null, reason: 'missing_credentials' } });
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!isValidEmail(normalizedEmail)) {
    await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, newValue: { email: normalizedEmail, reason: 'invalid_email' } });
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    const [staffUsers] = await pool.query(
      `SELECT user_id, email, password_hash, role, full_name, status
       FROM Users WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    );

    let user = staffUsers[0];
    const matchedUserId = user?.user_id ?? null;

    if (user && (user.status === 'inactive' || !(await bcrypt.compare(password, user.password_hash)))) {
      user = null;
    }

    if (!user) {
      const [customers] = await pool.query(
        `SELECT customer_id AS user_id, email, password_hash, first_name, last_name, is_registered, is_active
         FROM Customer WHERE email = ? LIMIT 1`,
        [normalizedEmail]
      );

      const customer = customers[0];
      if (customer && customer.is_registered && await bcrypt.compare(password, customer.password_hash)) {
        if (!customer.is_active) {
          await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, userId: customer.user_id, newValue: { email: normalizedEmail, reason: 'customer_inactive' } });
          return res.status(403).json({ error: 'This account has been deactivated. Please contact the resort.' });
        }

        user = {
          user_id: customer.user_id,
          email: customer.email,
          role: 'customer',
          full_name: `${customer.first_name} ${customer.last_name}`,
        };
      }
    }

    if (!user) {
      await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, userId: matchedUserId, newValue: { email: normalizedEmail, reason: 'invalid_credentials_or_inactive_account' } });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    res.cookie(COOKIE_NAME, token, cookieOptions);
    await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN, userId: user.role === 'customer' ? null : user.user_id, newValue: { email: normalizedEmail, role: user.role } });
    return res.status(200).json({ user: publicUser(user) });
  } catch (err) {
    console.error('[login] Error:', err.message);
    return res.status(500).json({ error: 'Failed to log in.' });
  }
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    req.user = jwt.verify(token, getJwtSecret());
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

function logout(req, res) {
  let userId = null;
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      userId = jwt.verify(token, getJwtSecret()).user_id ?? null;
    } catch {
      userId = null;
    }
  }
  writeAuthAudit({ action: ACTIONS.AUTH_LOGOUT, userId, newValue: { reason: 'logout' } });
  res.clearCookie(COOKIE_NAME, cookieOptions);
  return res.status(204).send();
}

async function getCurrentUser(req, res) {
  try {
    if (req.user.role === 'customer') {
      const [customers] = await pool.query(
        `SELECT customer_id AS user_id, email, first_name, last_name, is_registered
         FROM Customer WHERE customer_id = ? LIMIT 1`,
        [req.user.user_id]
      );
      const customer = customers[0];

      if (!customer || !customer.is_registered) {
        return res.status(401).json({ error: 'Customer account is inactive or no longer exists.' });
      }

      return res.status(200).json({
        user: publicUser({
          ...customer,
          role: 'customer',
          full_name: `${customer.first_name} ${customer.last_name}`,
        }),
      });
    }

    const [users] = await pool.query(
      `SELECT user_id, email, role, full_name, status
       FROM Users WHERE user_id = ? LIMIT 1`,
      [req.user.user_id]
    );

    if (!users[0] || users[0].status === 'inactive') {
      return res.status(401).json({ error: 'Staff account is inactive or no longer exists.' });
    }

    return res.status(200).json({ user: publicUser(users[0]) });
  } catch (err) {
    console.error('[getCurrentUser] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load current user.' });
  }
}

module.exports = { registerCustomer, login, requireAuth, logout, getCurrentUser };