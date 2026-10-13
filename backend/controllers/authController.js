const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { cookieOptions } = require('../config/security');
const { getJwtSecret } = require('../utils/jwtSecret');
const { validateAdultDateOfBirth } = require('../utils/ageCheck');
const { sendPasswordReset, sendPasswordChanged } = require('../services/emailService');

const SALT_ROUNDS = 12;
const COOKIE_NAME = 'kairos_auth';
const STAFF_ROLES = new Set(['admin', 'receptionist']);
const PASSWORD_CLAIM_INTRODUCED_AT = Math.floor(Date.now() / 1000);
const PASSWORD_RESET_MESSAGE = "If an account exists, we've sent a reset link";
const UNDERAGE_MESSAGE = 'You must be at least 18 years old to create an account.';
const INVALID_LOGIN_MESSAGE = 'Invalid email or password.';
const GOOGLE_FAILURE_MESSAGE = 'Google sign-in could not be completed.';
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('kairos-dummy-password', SALT_ROUNDS);
const googleClient = new OAuth2Client();

function isMissingPasswordColumnError(err) {
  return err?.code === 'ER_BAD_FIELD_ERROR'
    && /(must_change_password|password_changed_at)/i.test(err.message || '');
}

function staffTokenPayload(user) {
  const payload = { user_id: user.user_id, role: user.role };
  if (user.password_changed_at !== undefined) {
    payload.password_changed_at = user.password_changed_at
      ? new Date(user.password_changed_at).toISOString()
      : null;
  }
  return payload;
}

function setStaffAuthCookie(res, user) {
  const token = jwt.sign(staffTokenPayload(user), getJwtSecret(), { expiresIn: '1d' });
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isMissingCustomerAuthFeatureError(err) {
  return err?.code === 'ER_BAD_FIELD_ERROR' || err?.code === 'ER_NO_SUCH_TABLE';
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

function customerToken(user) {
  return jwt.sign({ user_id: user.user_id, role: 'customer' }, getJwtSecret(), { expiresIn: '1d' });
}

function setCustomerAuthCookie(res, user) {
  res.cookie(COOKIE_NAME, customerToken(user), cookieOptions);
}

function normalizedName(value, fallback) {
  const clean = typeof value === 'string' ? value.trim() : '';
  return clean || fallback;
}

function pendingGoogleToken(profile) {
  return jwt.sign({
    purpose: 'google_signup',
    sub: profile.sub,
    email: profile.email,
    first_name: profile.first_name,
    last_name: profile.last_name,
  }, getJwtSecret(), { expiresIn: '10m' });
}

function safeHashEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'hex');
  const rightBuffer = Buffer.from(String(right || ''), 'hex');
  return leftBuffer.length === rightBuffer.length
    && leftBuffer.length === 32
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function publicUser(user) {
  const result = {
    user_id: user.user_id,
    email: user.email,
    phone_number: user.phone_number,
    address: user.address,
    role: user.role,
    full_name: user.full_name,
  };
  if (user.role !== 'customer') result.must_change_password = Boolean(user.must_change_password);
  return result;
}

async function writeAuthAudit({ action, userId = null, newValue }) {
  try {
    let auditUserId = null;
    if (userId !== null && userId !== undefined) {
      const [staffRows] = await pool.query(
        'SELECT user_id FROM Users WHERE user_id = ? LIMIT 1',
        [userId]
      );
      auditUserId = staffRows[0]?.user_id ?? null;
    }
    await logAudit({ userId: auditUserId, action, entityType: ENTITY_TYPES.USER_SESSION, newValue });
  } catch (err) {
    console.error('[writeAuthAudit] Error:', err.message);
  }
}

async function registerCustomer(req, res) {
  const { firstName, lastName, email, phone, password, dateOfBirth } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!firstName?.trim() || !lastName?.trim() || !normalizedEmail || !phone?.trim() || !password || !dateOfBirth) {
    return res.status(400).json({ error: 'First name, last name, email, phone, date of birth, and password are required.' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters long.' });
  }

  const ageCheck = validateAdultDateOfBirth(dateOfBirth);
  if (!ageCheck.valid) {
    return res.status(ageCheck.reason === 'underage' ? 403 : 400).json({
      error: ageCheck.reason === 'underage' ? UNDERAGE_MESSAGE : 'Please provide a valid date of birth.',
    });
  }

  try {
    const [existingCustomers] = await pool.query(
      'SELECT customer_id FROM Customer WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    const [existingStaff] = await pool.query(
      'SELECT user_id FROM Users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existingCustomers.length > 0 || existingStaff.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      `INSERT INTO Customer (first_name, last_name, email, phone_number, password_hash, date_of_birth, is_registered)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [firstName.trim(), lastName.trim(), normalizedEmail, phone.trim(), passwordHash, dateOfBirth]
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
  const portal = req.body?.portal;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (portal !== 'customer' && portal !== 'staff') {
    await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, newValue: { reason: 'invalid_portal' } });
    return res.status(401).json({ error: INVALID_LOGIN_MESSAGE });
  }

  if (!normalizedEmail || !password) {
    await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, newValue: { reason: 'missing_credentials' } });
    return res.status(401).json({ error: INVALID_LOGIN_MESSAGE });
  }

  if (!isValidEmail(normalizedEmail)) {
    await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, newValue: { reason: 'invalid_email' } });
    return res.status(401).json({ error: INVALID_LOGIN_MESSAGE });
  }

  try {
    let user = null;
    let account;
    let failureReason = 'invalid_credentials_or_inactive_account';
    if (portal === 'customer') {
      const [customers] = await pool.query(
        `SELECT customer_id AS user_id, email, password_hash, first_name, last_name, phone_number, address, is_registered, is_active
         FROM Customer WHERE email = ? LIMIT 1`,
        [normalizedEmail]
      );
      account = customers[0];
      const passwordMatches = await bcrypt.compare(password, account?.password_hash || DUMMY_PASSWORD_HASH);
      if (account && account.is_registered && account.password_hash && passwordMatches) {
        if (!account.is_active) {
          await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, newValue: { reason: 'customer_inactive' } });
          return res.status(403).json({ error: 'This account has been deactivated. Please contact the resort.' });
        }
        user = {
          user_id: account.user_id,
          email: account.email,
          phone_number: account.phone_number,
          address: account.address,
          role: 'customer',
          full_name: `${account.first_name} ${account.last_name}`,
        };
      } else if (!account) {
        const [staffMatches] = await pool.query(
          'SELECT user_id FROM Users WHERE email = ? LIMIT 1',
          [normalizedEmail]
        );
        if (staffMatches.length > 0) {
          failureReason = 'staff_account_on_customer_portal';
        }
      }
    } else {
      let staffColumnsAvailable = true;
      let staffUsers;
      try {
        [staffUsers] = await pool.query(
          `SELECT user_id, email, password_hash, role, full_name, status, must_change_password, password_changed_at
           FROM Users WHERE email = ? LIMIT 1`,
          [normalizedEmail]
        );
      } catch (err) {
        if (!isMissingPasswordColumnError(err)) throw err;
        staffColumnsAvailable = false;
        [staffUsers] = await pool.query(
          `SELECT user_id, email, password_hash, role, full_name, status
           FROM Users WHERE email = ? LIMIT 1`,
          [normalizedEmail]
        );
      }
      account = staffUsers[0];
      const passwordMatches = await bcrypt.compare(password, account?.password_hash || DUMMY_PASSWORD_HASH);
      if (account && account.status !== 'inactive' && passwordMatches) {
        user = account;
      }
      if (user && !staffColumnsAvailable) user.must_change_password = false;
    }

    if (!user) {
      await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, newValue: { reason: failureReason } });
      return res.status(401).json({ error: INVALID_LOGIN_MESSAGE });
    }

    if (user.role === 'customer') {
      setCustomerAuthCookie(res, user);
    } else {
      setStaffAuthCookie(res, user);
    }

    await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN, userId: user.role === 'customer' ? null : user.user_id, newValue: { role: user.role } });
    return res.status(200).json({ user: publicUser(user) });
  } catch (err) {
    console.error('[login] Error:', err.message);
    return res.status(500).json({ error: 'Failed to log in.' });
  }
}

async function forgotPassword(req, res) {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const genericResponse = () => res.status(200).json({ message: PASSWORD_RESET_MESSAGE });
      if (!isValidEmail(email)) return genericResponse();

      try {
        const [customers] = await pool.query(
          'SELECT customer_id, email FROM Customer WHERE email = ? AND is_registered = TRUE LIMIT 1',
          [email]
        );
        const customer = customers[0];
        if (!customer) return genericResponse();

        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await pool.query(
          'UPDATE PasswordResetTokens SET used_at = CURRENT_TIMESTAMP WHERE customer_id = ? AND used_at IS NULL',
          [customer.customer_id]
        );
        await pool.query(
          `INSERT INTO PasswordResetTokens (customer_id, token_hash, expires_at, requested_ip)
           VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 60 MINUTE), ?)`,
          [customer.customer_id, tokenHash, req.ip || null]
        );

        if (!process.env.PUBLIC_APP_URL) {
          console.warn('[forgotPassword] PUBLIC_APP_URL is not configured; reset email skipped.');
          return genericResponse();
        }
        const link = `${process.env.PUBLIC_APP_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
        void sendPasswordReset(customer.email, link);
        return genericResponse();
      } catch (err) {
        if (!isMissingCustomerAuthFeatureError(err)) {
          console.error('[forgotPassword] Error:', err.message);
        } else {
          console.error('[forgotPassword] Password reset storage is unavailable:', err.message);
        }
        return genericResponse();
      }
    }

async function resetPassword(req, res) {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      const password = req.body?.password;
      if (!token || !isValidPassword(password)) {
        return res.status(400).json({ error: 'Invalid or expired password reset link.' });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const connection = await pool.getConnection().catch((err) => {
        console.error('[resetPassword] Database connection error:', err.message);
        return null;
      });
      if (!connection) return res.status(503).json({ error: 'Password reset is temporarily unavailable.' });

      try {
        await connection.beginTransaction();
        const [tokens] = await connection.query(
          `SELECT pr.token_id, pr.customer_id, pr.token_hash, c.email, c.first_name, c.last_name
           FROM PasswordResetTokens pr
           INNER JOIN Customer c ON c.customer_id = pr.customer_id
           WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > CURRENT_TIMESTAMP
           LIMIT 1`,
          [tokenHash]
        );
        const resetToken = tokens[0];
        if (!resetToken || !safeHashEqual(resetToken.token_hash, tokenHash)) {
          await connection.rollback();
          return res.status(400).json({ error: 'Invalid or expired password reset link.' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        await connection.query('UPDATE Customer SET password_hash = ?, is_registered = TRUE WHERE customer_id = ?', [passwordHash, resetToken.customer_id]);
        await connection.query('UPDATE PasswordResetTokens SET used_at = CURRENT_TIMESTAMP WHERE token_id = ?', [resetToken.token_id]);
        await connection.query(
          'UPDATE PasswordResetTokens SET used_at = CURRENT_TIMESTAMP WHERE customer_id = ? AND used_at IS NULL AND token_id <> ?',
          [resetToken.customer_id, resetToken.token_id]
        );
        await connection.commit();
        void sendPasswordChanged(resetToken.email, `${resetToken.first_name} ${resetToken.last_name}`.trim());
        return res.status(200).json({ message: 'Password reset successfully.' });
      } catch (err) {
        await connection.rollback().catch(() => {});
        if (isMissingCustomerAuthFeatureError(err)) {
          return res.status(503).json({ error: 'Password reset is temporarily unavailable until the database migration is applied.' });
        }
        console.error('[resetPassword] Error:', err.message);
        return res.status(500).json({ error: 'Password reset failed.' });
      } finally {
        connection.release();
      }
    }

async function googleSignIn(req, res) {
      const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
      if (!credential || !process.env.GOOGLE_CLIENT_ID) {
        return res.status(503).json({ error: 'Google sign-in is unavailable.' });
      }

      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
        payload = ticket.getPayload();
      } catch (err) {
        return res.status(401).json({ error: 'Google sign-in could not be verified.' });
      }
      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        return res.status(401).json({ error: 'Google sign-in could not be verified.' });
      }

      const profile = {
        sub: payload.sub,
        email: payload.email.trim().toLowerCase(),
        first_name: normalizedName(payload.given_name, 'Google'),
        last_name: normalizedName(payload.family_name, 'User'),
      };
      const connection = await pool.getConnection().catch((err) => {
        console.error('[googleSignIn] Database connection error:', err.message);
        return null;
      });
      if (!connection) return res.status(503).json({ error: 'Google sign-in is temporarily unavailable.' });

      try {
        await connection.beginTransaction();
        const [staffMatches] = await connection.query(
          'SELECT user_id FROM Users WHERE email = ? LIMIT 1',
          [profile.email]
        );
        if (staffMatches.length > 0) {
          await connection.rollback();
          return res.status(401).json({ error: GOOGLE_FAILURE_MESSAGE });
        }
        const [byGoogle] = await connection.query(
          'SELECT customer_id AS user_id, email, first_name, last_name, phone_number, address, is_registered, is_active, date_of_birth FROM Customer WHERE google_sub = ? LIMIT 1',
          [profile.sub]
        );
        let customer = byGoogle[0];
        if (!customer) {
          const [byEmail] = await connection.query(
            'SELECT customer_id AS user_id, email, first_name, last_name, phone_number, address, is_registered, is_active, date_of_birth FROM Customer WHERE email = ? LIMIT 1',
            [profile.email]
          );
          customer = byEmail[0];
        }
        if (!customer || !customer.date_of_birth) {
          await connection.rollback();
          return res.status(200).json({ needs_birthday: true, pending_token: pendingGoogleToken(profile) });
        }
        if (!customer.is_active) {
          await connection.rollback();
          return res.status(403).json({ error: 'This account has been deactivated. Please contact the resort.' });
        }
        await connection.query(
          'UPDATE Customer SET google_sub = ?, is_registered = TRUE WHERE customer_id = ?',
          [profile.sub, customer.user_id]
        );
        await connection.commit();
        setCustomerAuthCookie(res, { user_id: customer.user_id });
        return res.status(200).json({ user: publicUser({ ...customer, role: 'customer', full_name: `${customer.first_name} ${customer.last_name}` }) });
      } catch (err) {
        await connection.rollback().catch(() => {});
        if (isMissingCustomerAuthFeatureError(err)) return res.status(503).json({ error: 'Google sign-in is temporarily unavailable until the database migration is applied.' });
        console.error('[googleSignIn] Error:', err.message);
        return res.status(500).json({ error: 'Google sign-in failed.' });
      } finally {
        connection.release();
      }
    }

async function completeGoogleSignIn(req, res) {
      const pendingToken = typeof req.body?.pending_token === 'string' ? req.body.pending_token : '';
      const dateOfBirth = req.body?.date_of_birth;
      let pending;
      try {
        pending = jwt.verify(pendingToken, getJwtSecret());
      } catch {
        return res.status(400).json({ error: 'Google sign-up session expired. Please try again.' });
      }
      if (pending.purpose !== 'google_signup' || !pending.sub || !pending.email) {
        return res.status(400).json({ error: 'Google sign-up session expired. Please try again.' });
      }
      const ageCheck = validateAdultDateOfBirth(dateOfBirth);
      if (!ageCheck.valid) {
        return res.status(ageCheck.reason === 'underage' ? 403 : 400).json({
          error: ageCheck.reason === 'underage' ? UNDERAGE_MESSAGE : 'Please provide a valid date of birth.',
        });
      }

      const connection = await pool.getConnection().catch((err) => {
        console.error('[completeGoogleSignIn] Database connection error:', err.message);
        return null;
      });
      if (!connection) return res.status(503).json({ error: 'Google sign-in is temporarily unavailable.' });
      try {
        await connection.beginTransaction();
        const [staffMatches] = await connection.query(
          'SELECT user_id FROM Users WHERE email = ? LIMIT 1',
          [pending.email]
        );
        if (staffMatches.length > 0) {
          await connection.rollback();
          return res.status(401).json({ error: GOOGLE_FAILURE_MESSAGE });
        }
        const [byGoogle] = await connection.query(
          'SELECT customer_id AS user_id, email, first_name, last_name, phone_number, address, is_registered, is_active FROM Customer WHERE google_sub = ? LIMIT 1',
          [pending.sub]
        );
        let customer = byGoogle[0];
        if (!customer) {
          const [byEmail] = await connection.query(
            'SELECT customer_id AS user_id, email, first_name, last_name, phone_number, address, is_registered, is_active FROM Customer WHERE email = ? LIMIT 1',
            [pending.email]
          );
          customer = byEmail[0];
        }
        if (customer) {
          if (!customer.is_active) {
            await connection.rollback();
            return res.status(403).json({ error: 'This account has been deactivated. Please contact the resort.' });
          }
          await connection.query(
            'UPDATE Customer SET google_sub = ?, date_of_birth = ?, is_registered = TRUE WHERE customer_id = ?',
            [pending.sub, dateOfBirth, customer.user_id]
          );
        } else {
          const [result] = await connection.query(
            `INSERT INTO Customer (first_name, last_name, email, phone_number, address, password_hash, date_of_birth, google_sub, is_registered)
             VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, TRUE)`,
            [pending.first_name, pending.last_name, pending.email, '', dateOfBirth, pending.sub]
          );
          customer = { user_id: result.insertId, email: pending.email, first_name: pending.first_name, last_name: pending.last_name, phone_number: '', address: null, is_registered: 1 };
        }
        await connection.commit();
        setCustomerAuthCookie(res, { user_id: customer.user_id });
        return res.status(200).json({ user: publicUser({ ...customer, role: 'customer', full_name: `${customer.first_name} ${customer.last_name}` }) });
      } catch (err) {
        await connection.rollback().catch(() => {});
        if (isMissingCustomerAuthFeatureError(err)) return res.status(503).json({ error: 'Google sign-in is temporarily unavailable until the database migration is applied.' });
        console.error('[completeGoogleSignIn] Error:', err.message);
        return res.status(500).json({ error: 'Google sign-in failed.' });
      } finally {
        connection.release();
      }
    }
async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    req.user = jwt.verify(token, getJwtSecret());
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  if (req.user.role === 'customer') return next();

  try {
    let users;
    let passwordColumnsAvailable = true;
    try {
      [users] = await pool.query(
        'SELECT status, password_changed_at FROM Users WHERE user_id = ? AND role IN ("admin", "receptionist") LIMIT 1',
        [req.user.user_id]
      );
    } catch (err) {
      if (!isMissingPasswordColumnError(err)) throw err;
      passwordColumnsAvailable = false;
      [users] = await pool.query(
        'SELECT status FROM Users WHERE user_id = ? AND role IN ("admin", "receptionist") LIMIT 1',
        [req.user.user_id]
      );
    }

    const staff = users[0];
    if (!staff || staff.status === 'inactive') {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    if (req.user.password_changed_at !== undefined) {
      const databasePasswordChangedAt = staff.password_changed_at
        ? new Date(staff.password_changed_at).toISOString()
        : null;
      if (databasePasswordChangedAt !== req.user.password_changed_at) {
        return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
      }
    } else if (passwordColumnsAvailable && req.user.iat >= PASSWORD_CLAIM_INTRODUCED_AT) {
      return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
    }

    return next();
  } catch (err) {
    console.error('[requireAuth] Error:', err.message);
    return res.status(401).json({ error: 'Unable to validate session.' });
  }
}

function logout(req, res) {
  let userId = null;
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, getJwtSecret());
      userId = payload.role === 'customer' ? null : (payload.user_id ?? null);
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
    const requestedPortal = req.query?.portal || req.get('x-portal');
    if ((requestedPortal === 'customer' && req.user.role !== 'customer')
      || (requestedPortal === 'staff' && req.user.role === 'customer')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role === 'customer') {
      const [customers] = await pool.query(
        `SELECT customer_id AS user_id, email, first_name, last_name, phone_number, address, is_registered
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

    let users;
    try {
      [users] = await pool.query(
        `SELECT user_id, email, role, full_name, status, must_change_password
         FROM Users WHERE user_id = ? LIMIT 1`,
        [req.user.user_id]
      );
    } catch (err) {
      if (!isMissingPasswordColumnError(err)) throw err;
      [users] = await pool.query(
        `SELECT user_id, email, role, full_name, status
         FROM Users WHERE user_id = ? LIMIT 1`,
        [req.user.user_id]
      );
    }

    if (!users[0] || users[0].status === 'inactive') {
      return res.status(401).json({ error: 'Staff account is inactive or no longer exists.' });
    }

    return res.status(200).json({ user: publicUser(users[0]) });
  } catch (err) {
    console.error('[getCurrentUser] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load current user.' });
  }
}

async function changePassword(req, res) {
  if (!STAFF_ROLES.has(req.user?.role)) {
    return res.status(403).json({ error: 'Only staff accounts can change a staff password.' });
  }

  const currentPassword = typeof req.body.current_password === 'string' ? req.body.current_password : '';
  const newPassword = typeof req.body.new_password === 'string' ? req.body.new_password : '';
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: 'New password must be between 8 and 128 characters.' });
  }

  try {
    let users;
    try {
      [users] = await pool.query(
        `SELECT user_id, email, role, full_name, status, password_hash, must_change_password
         FROM Users WHERE user_id = ? AND role IN ("admin", "receptionist") LIMIT 1`,
        [req.user.user_id]
      );
    } catch (err) {
      if (!isMissingPasswordColumnError(err)) throw err;
      return res.status(503).json({ error: 'Password changes are unavailable until the database migration is applied.' });
    }

    const user = users[0];
    if (!user || user.status === 'inactive') return res.status(401).json({ error: 'Staff account is inactive or no longer exists.' });
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ error: 'New password must be different from the current password.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE Users SET password_hash = ?, must_change_password = FALSE, password_changed_at = CURRENT_TIMESTAMP(6) WHERE user_id = ?',
      [passwordHash, user.user_id]
    );
    const [updated] = await pool.query(
      'SELECT password_changed_at, must_change_password FROM Users WHERE user_id = ? LIMIT 1',
      [user.user_id]
    );
    setStaffAuthCookie(res, { ...user, ...updated[0] });
    await writeAuthAudit({
      action: ACTIONS.AUTH_PASSWORD_CHANGE,
      userId: user.user_id,
      newValue: { role: user.role, forced: Boolean(user.must_change_password) },
    });
    return res.status(200).json({ message: 'Password changed successfully.', user: publicUser({ ...user, ...updated[0] }) });
  } catch (err) {
    console.error('[changePassword] Error:', err.message);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
}

module.exports = {
  registerCustomer,
  login,
  forgotPassword,
  resetPassword,
  googleSignIn,
  completeGoogleSignIn,
  requireAuth,
  logout,
  getCurrentUser,
  changePassword,
  SALT_ROUNDS,
  STAFF_ROLES,
};