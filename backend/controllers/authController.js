const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/db');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { cookieOptions, getClientIp } = require('../config/security');
const { getJwtSecret } = require('../utils/jwtSecret');
const { validateAdultDateOfBirth } = require('../utils/ageCheck');
const { sendPasswordReset, sendPasswordChanged, sendVerificationCode } = require('../services/emailService');
const {
  hashEmail,
  getActiveCooldown,
  recordFailedAttempt,
  resetFailedAttempts,
} = require('../utils/staffLoginAttempts');
const { isValidStaffPassword } = require('../utils/staffPassword');
const { signJwt, verifyJwt } = require('../utils/sessionJwt');
const { verificationCodeHash } = require('../utils/authVerification');

const SALT_ROUNDS = 12;
const COOKIE_NAME = 'kairos_auth';
const STAFF_ROLES = new Set(['admin', 'receptionist']);
const PASSWORD_CLAIM_INTRODUCED_AT = Math.floor(Date.now() / 1000);
const PASSWORD_RESET_MESSAGE = "If an account exists, we've sent a reset link";
const UNDERAGE_MESSAGE = 'You must be at least 18 years old to create an account.';
const INVALID_LOGIN_MESSAGE = 'Invalid email or password.';
const GOOGLE_FAILURE_MESSAGE = 'Google sign-in could not be completed.';
const VERIFICATION_CODE_MESSAGE = 'Invalid or expired code.';
const VERIFICATION_COOLDOWN_MS = 60 * 1000;
const VERIFICATION_EXPIRY_MINUTES = 10;
const LOGIN_CODE_ENABLED = String(process.env.LOGIN_CODE_ENABLED || 'true').toLowerCase() !== 'false';
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('kairos-dummy-password', SALT_ROUNDS);
const configuredSessionHours = Number(process.env.STAFF_SESSION_HOURS || 8);
const STAFF_SESSION_HOURS = Number.isInteger(configuredSessionHours) && configuredSessionHours > 0
  ? configuredSessionHours
  : 8;
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
  const token = signJwt(staffTokenPayload(user), getJwtSecret(), `${STAFF_SESSION_HOURS}h`);
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: STAFF_SESSION_HOURS * 60 * 60 * 1000,
  });
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
  return signJwt({ user_id: user.user_id, role: 'customer' }, getJwtSecret(), '1d');
}

function setCustomerAuthCookie(res, user) {
  res.cookie(COOKIE_NAME, customerToken(user), cookieOptions);
}

function normalizedName(value, fallback) {
  const clean = typeof value === 'string' ? value.trim() : '';
  return clean || fallback;
}

function pendingGoogleToken(profile) {
  return signJwt({
    purpose: 'google_signup',
    sub: profile.sub,
    email: profile.email,
    first_name: profile.first_name,
    last_name: profile.last_name,
  }, getJwtSecret(), '10m');
}

function safeHashEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'hex');
  const rightBuffer = Buffer.from(String(right || ''), 'hex');
  return leftBuffer.length === rightBuffer.length
    && leftBuffer.length === 32
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function maskedEmail(email) {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

function verificationCooldownRemaining(lastSentAt) {
  return Math.max(0, VERIFICATION_COOLDOWN_MS - (Date.now() - new Date(lastSentAt).getTime()));
}

async function createVerificationCode({ purpose, customerId, email, challenge }) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const challengeHash = challenge ? sha256(challenge) : null;
  await pool.query(
    `UPDATE Auth_Verification_Codes
     SET consumed_at = CURRENT_TIMESTAMP
     WHERE email = ? AND purpose = ? AND consumed_at IS NULL`,
    [email, purpose]
  );
  const [result] = await pool.query(
    `INSERT INTO Auth_Verification_Codes
      (purpose, customer_id, email, code_hash, challenge_hash, expires_at, last_sent_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${VERIFICATION_EXPIRY_MINUTES} MINUTE), CURRENT_TIMESTAMP)`,
    [purpose, customerId, email, verificationCodeHash(code), challengeHash]
  );
  try {
    await sendVerificationCode({ to: email, code, purpose });
  } catch (err) {
    try {
      await pool.query(
        'UPDATE Auth_Verification_Codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = ? AND consumed_at IS NULL',
        [result.insertId]
      );
    } catch (cleanupError) {
      console.error('[createVerificationCode] Failed to invalidate unsent verification code:', cleanupError.message);
    }
    throw err;
  }
}

async function sendCodeOr503(res, details) {
  try {
    await createVerificationCode(details);
    return true;
  } catch (err) {
    if (err.statusCode === 503) {
      res.status(503).json({ error: 'Verification email service is temporarily unavailable.' });
      return false;
    }
    throw err;
  }
}

function isVerificationEnabled() {
  return LOGIN_CODE_ENABLED;
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

async function writeAuthAudit({ action, userId = null, newValue, req, email }) {
  try {
    const details = { ...(newValue || {}) };
    if (req) {
      details.user_agent = String(req.get?.('user-agent') || req.headers?.['user-agent'] || '').slice(0, 255);
      if (typeof email === 'string' && email && email.length <= 254) details.email_hash = hashEmail(email);
    }
    const entry = {
      userId: userId ?? null,
      action,
      entityType: ENTITY_TYPES.USER_SESSION,
      newValue: details,
      ipAddress: req ? getClientIp(req) : null,
    };
    try {
      await logAudit(entry);
    } catch (err) {
      if (entry.userId === null || err.code !== 'ER_NO_REFERENCED_ROW_2') throw err;
      await logAudit({ ...entry, userId: null });
    }
  } catch (err) {
    console.error('[writeAuthAudit] Error:', err.message);
  }
}

async function recordStaffLoginThrottle(req) {
  const rawEmail = req.body?.email;
  const password = req.body?.password;
  const validInput = typeof rawEmail === 'string'
    && rawEmail.length <= 254
    && typeof password === 'string'
    && password.length > 0
    && password.length <= 128;
  const email = validInput ? rawEmail.trim().toLowerCase() : '';
  let userId = null;
  if (validInput && isValidEmail(email)) {
    try {
      const [users] = await pool.query('SELECT user_id FROM Users WHERE email = ? LIMIT 1', [email]);
      userId = users[0]?.user_id ?? null;
    } catch (err) {
      console.error('[recordStaffLoginThrottle] Account lookup failed:', err.message);
    }
  }
  await writeAuthAudit({
    action: ACTIONS.AUTH_LOGIN_THROTTLED,
    userId,
    req,
    email,
    newValue: { reason: 'ip_rate_limit' },
  });
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

  if (!/^09\d{9}$/.test(phone.trim())) {
    return res.status(400).json({ error: 'Please provide a valid 11-digit Philippine mobile number.' });
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
      'SELECT customer_id, is_registered, email_verified_at FROM Customer WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    const [existingStaff] = await pool.query(
      'SELECT user_id FROM Users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existingStaff.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    let customerId;
    const existing = existingCustomers[0];
    if (existing?.is_registered && existing.email_verified_at) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    if (existing?.is_registered && !existing.email_verified_at) {
      const [recentCodes] = await pool.query(
        `SELECT last_sent_at FROM Auth_Verification_Codes
         WHERE email = ? AND purpose = 'register' AND consumed_at IS NULL
         ORDER BY id DESC LIMIT 1`,
        [normalizedEmail]
      );
      if (recentCodes[0] && verificationCooldownRemaining(recentCodes[0].last_sent_at) > 0) {
        return res.status(429).json({ error: 'Please wait before requesting another verification code.' });
      }
    }
    if (existing?.is_registered && !existing.email_verified_at) {
      customerId = existing.customer_id;
      await pool.query(
        `UPDATE Customer
         SET first_name = ?, last_name = ?, phone_number = ?, password_hash = ?, date_of_birth = ?, is_active = TRUE
         WHERE customer_id = ?`,
        [firstName.trim(), lastName.trim(), phone.trim(), passwordHash, dateOfBirth, customerId]
      );
    } else if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in to book.' });
    } else {
      const [result] = await pool.query(
        `INSERT INTO Customer (first_name, last_name, email, phone_number, password_hash, date_of_birth, is_registered, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, TRUE, NULL)`,
        [firstName.trim(), lastName.trim(), normalizedEmail, phone.trim(), passwordHash, dateOfBirth]
      );
      customerId = result.insertId;
    }

    if (!await sendCodeOr503(res, { purpose: 'register', customerId, email: normalizedEmail })) return;
    return res.status(201).json({ verification_required: true, email: normalizedEmail });
  } catch (err) {
    if (isMissingCustomerAuthFeatureError(err)) {
      return res.status(503).json({ error: 'Email verification is temporarily unavailable until the database migration is applied.' });
    }
    console.error('[registerCustomer] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create customer account.' });
  }
}

async function login(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { email, password } = body;
  const portal = req.body?.portal;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const validCredentialsShape = typeof email === 'string'
    && email.length <= 254
    && typeof password === 'string'
    && password.length > 0
    && password.length <= 128;
  if (portal !== 'customer' && portal !== 'staff') {
    await writeAuthAudit({
      action: ACTIONS.AUTH_LOGIN_FAILED,
      req,
      email: normalizedEmail,
      newValue: { reason: 'invalid_portal' },
    });
    return res.status(401).json({ error: INVALID_LOGIN_MESSAGE });
  }

  if (!validCredentialsShape || !normalizedEmail || !password) {
    await writeAuthAudit({
      action: ACTIONS.AUTH_LOGIN_FAILED,
      req,
      email: normalizedEmail,
      newValue: { reason: 'invalid_credentials_shape' },
    });
    return res.status(401).json({ error: INVALID_LOGIN_MESSAGE });
  }

  if (!isValidEmail(normalizedEmail)) {
    await writeAuthAudit({
      action: ACTIONS.AUTH_LOGIN_FAILED,
      req,
      email: normalizedEmail,
      newValue: { reason: 'invalid_email' },
    });
    return res.status(401).json({ error: INVALID_LOGIN_MESSAGE });
  }

  try {
    const emailHash = portal === 'staff' ? hashEmail(normalizedEmail) : null;
    if (portal === 'staff') {
      const cooldown = await getActiveCooldown(emailHash);
      if (cooldown) {
        res.set('Retry-After', String(cooldown.retryAfter));
        await writeAuthAudit({
          action: ACTIONS.AUTH_LOGIN_THROTTLED,
          userId: cooldown.userId,
          req,
          email: normalizedEmail,
          newValue: { reason: 'account_cooldown', retry_after: cooldown.retryAfter },
        });
        return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
      }
    }

    let user = null;
    let account;
    let failureReason = 'invalid_credentials_or_inactive_account';
    if (portal === 'customer') {
      const [customers] = await pool.query(
        `SELECT customer_id AS user_id, email, password_hash, first_name, last_name, phone_number, address, is_registered, is_active, email_verified_at
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
          `SELECT user_id, email, password_hash, role, full_name, status, is_active, must_change_password, password_changed_at
           FROM Users WHERE email = ? LIMIT 1`,
          [normalizedEmail]
        );
      } catch (err) {
        if (!isMissingPasswordColumnError(err)) throw err;
        staffColumnsAvailable = false;
        [staffUsers] = await pool.query(
          `SELECT user_id, email, password_hash, role, full_name, status, is_active
           FROM Users WHERE email = ? LIMIT 1`,
          [normalizedEmail]
        );
      }
      account = staffUsers[0];
      const activeStaff = account
        && STAFF_ROLES.has(account.role)
        && account.status !== 'inactive'
        && Boolean(account.is_active);
      let passwordMatches;
      if (activeStaff && account.password_hash) {
        const rounds = bcrypt.getRounds(account.password_hash);
        if (rounds < SALT_ROUNDS) {
          const [accountPasswordMatches] = await Promise.all([
            bcrypt.compare(password, account.password_hash),
            bcrypt.compare(password, DUMMY_PASSWORD_HASH),
          ]);
          passwordMatches = accountPasswordMatches;
        } else {
          passwordMatches = await bcrypt.compare(password, account.password_hash);
        }
      } else {
        passwordMatches = await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      }
      if (activeStaff && passwordMatches) {
        user = account;
      }
      if (user && !staffColumnsAvailable) user.must_change_password = false;
    }

    if (!user) {
      if (portal === 'staff') await recordFailedAttempt(emailHash, account?.user_id ?? null);
      await writeAuthAudit({
        action: ACTIONS.AUTH_LOGIN_FAILED,
        userId: portal === 'staff' ? account?.user_id ?? null : null,
        req,
        email: normalizedEmail,
        newValue: { reason: failureReason },
      });
      return res.status(401).json({ error: INVALID_LOGIN_MESSAGE });
    }

    if (user.role === 'customer') {
      if (!account.email_verified_at) {
        await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN_FAILED, newValue: { reason: 'customer_email_unverified' } });
        return res.status(401).json({ error: INVALID_LOGIN_MESSAGE });
      }
      if (isVerificationEnabled()) {
        const challenge = crypto.randomBytes(24).toString('base64url');
        if (!await sendCodeOr503(res, {
          purpose: 'login',
          customerId: account.user_id,
          email: account.email,
          challenge,
        })) return;
        return res.status(200).json({
          verification_required: true,
          challenge,
          email_hint: maskedEmail(account.email),
        });
      }
      setCustomerAuthCookie(res, user);
    } else {
      const rounds = account.password_hash ? bcrypt.getRounds(account.password_hash) : SALT_ROUNDS;
      if (rounds < SALT_ROUNDS) {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        await pool.query('UPDATE Users SET password_hash = ? WHERE user_id = ?', [passwordHash, account.user_id]);
      }
      await resetFailedAttempts(emailHash);
      setStaffAuthCookie(res, user);
    }

    await writeAuthAudit({
      action: ACTIONS.AUTH_LOGIN,
      userId: user.role === 'customer' ? null : user.user_id,
      req,
      email: normalizedEmail,
      newValue: { role: user.role },
    });
    return res.status(200).json({ user: publicUser(user) });
  } catch (err) {
    console.error('[login] Error:', err.message);
    return res.status(500).json({ error: 'Failed to log in.' });
  }
}

async function verifyRegistration(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: VERIFICATION_CODE_MESSAGE });
  }
  try {
    const [rows] = await pool.query(
      `SELECT id, customer_id, code_hash, attempts, max_attempts
       FROM Auth_Verification_Codes
       WHERE email = ? AND purpose = 'register' AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       ORDER BY id DESC LIMIT 1`,
      [email]
    );
    const record = rows[0];
    if (!record || record.attempts >= record.max_attempts) {
      console.warn(`[verifyRegistration] Verification record unavailable: ${record ? 'attempt_limit' : 'missing_expired_or_consumed'}.`);
      return res.status(400).json({ error: VERIFICATION_CODE_MESSAGE });
    }
    const matches = safeHashEqual(record.code_hash, verificationCodeHash(code));
    if (!matches) {
      const attempts = record.attempts + 1;
      await pool.query(
        `UPDATE Auth_Verification_Codes
         SET attempts = ?, consumed_at = IF(? >= max_attempts, CURRENT_TIMESTAMP, consumed_at)
         WHERE id = ? AND consumed_at IS NULL`,
        [attempts, attempts, record.id]
      );
      console.warn(`[verifyRegistration] Verification code mismatch; attempts=${attempts}.`);
      return res.status(400).json({ error: VERIFICATION_CODE_MESSAGE, remaining_attempts: Math.max(0, record.max_attempts - attempts) });
    }
    await pool.query('UPDATE Customer SET email_verified_at = CURRENT_TIMESTAMP WHERE customer_id = ? AND email = ? AND is_registered = TRUE', [record.customer_id, email]);
    await pool.query('UPDATE Auth_Verification_Codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
    return res.status(200).json({ message: 'Email verified successfully.' });
  } catch (err) {
    if (isMissingCustomerAuthFeatureError(err)) return res.status(503).json({ error: 'Email verification is temporarily unavailable until the database migration is applied.' });
    console.error('[verifyRegistration] Error:', err.message);
    return res.status(500).json({ error: 'Email verification failed.' });
  }
}

async function resendRegistrationCode(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const generic = () => res.status(200).json({ message: 'If an eligible account exists, a verification code has been sent.' });
  if (!isValidEmail(email)) return generic();
  try {
    const [customers] = await pool.query(
      `SELECT customer_id FROM Customer WHERE email = ? AND is_registered = TRUE AND email_verified_at IS NULL LIMIT 1`,
      [email]
    );
    const [recent] = await pool.query(
      `SELECT last_sent_at FROM Auth_Verification_Codes
       WHERE email = ? AND purpose = 'register' AND consumed_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      [email]
    );
    if (!customers[0] || (recent[0] && verificationCooldownRemaining(recent[0].last_sent_at) > 0)) return generic();
    await createVerificationCode({ purpose: 'register', customerId: customers[0].customer_id, email });
    return generic();
  } catch (err) {
    if (err.statusCode === 503) return res.status(503).json({ error: 'Verification email service is temporarily unavailable.' });
    if (!isMissingCustomerAuthFeatureError(err)) console.error('[resendRegistrationCode] Error:', err.message);
    return generic();
  }
}

async function verifyLogin(req, res) {
  const challenge = typeof req.body?.challenge === 'string' ? req.body.challenge : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!challenge || !/^\d{6}$/.test(code)) return res.status(400).json({ error: VERIFICATION_CODE_MESSAGE });
  try {
    const [rows] = await pool.query(
      `SELECT id, customer_id, email, code_hash, attempts, max_attempts
       FROM Auth_Verification_Codes
       WHERE challenge_hash = ? AND purpose = 'login' AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [sha256(challenge)]
    );
    const record = rows[0];
    if (!record || record.attempts >= record.max_attempts) return res.status(400).json({ error: VERIFICATION_CODE_MESSAGE });
    const matches = safeHashEqual(record.code_hash, verificationCodeHash(code));
    if (!matches) {
      const attempts = record.attempts + 1;
      await pool.query(
        `UPDATE Auth_Verification_Codes
         SET attempts = ?, consumed_at = IF(? >= max_attempts, CURRENT_TIMESTAMP, consumed_at)
         WHERE id = ? AND consumed_at IS NULL`,
        [attempts, attempts, record.id]
      );
      return res.status(400).json({ error: VERIFICATION_CODE_MESSAGE, remaining_attempts: Math.max(0, record.max_attempts - attempts) });
    }
    const [customers] = await pool.query(
      `SELECT customer_id AS user_id, email, phone_number, address, first_name, last_name
       FROM Customer WHERE customer_id = ? AND is_registered = TRUE AND is_active = TRUE AND email_verified_at IS NOT NULL LIMIT 1`,
      [record.customer_id]
    );
    const customer = customers[0];
    if (!customer) return res.status(400).json({ error: VERIFICATION_CODE_MESSAGE });
    await pool.query('UPDATE Auth_Verification_Codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
    const user = { ...customer, role: 'customer', full_name: `${customer.first_name} ${customer.last_name}` };
    setCustomerAuthCookie(res, user);
    await writeAuthAudit({ action: ACTIONS.AUTH_LOGIN, userId: null, newValue: { role: 'customer' } });
    return res.status(200).json({ user: publicUser(user) });
  } catch (err) {
    if (isMissingCustomerAuthFeatureError(err)) return res.status(503).json({ error: 'Email verification is temporarily unavailable until the database migration is applied.' });
    console.error('[verifyLogin] Error:', err.message);
    return res.status(500).json({ error: 'Login verification failed.' });
  }
}

async function resendLoginCode(req, res) {
  const challenge = typeof req.body?.challenge === 'string' ? req.body.challenge : '';
  if (!challenge) return res.status(200).json({ message: 'If the sign-in challenge is valid, a verification code has been sent.' });
  try {
    const [rows] = await pool.query(
      `SELECT customer_id, email, last_sent_at FROM Auth_Verification_Codes
       WHERE challenge_hash = ? AND purpose = 'login' AND consumed_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      [sha256(challenge)]
    );
    const current = rows[0];
    if (!current || verificationCooldownRemaining(current.last_sent_at) > 0) {
      return res.status(200).json({ message: 'If the sign-in challenge is valid, a verification code has been sent.' });
    }
    await createVerificationCode({ purpose: 'login', customerId: current.customer_id, email: current.email, challenge });
    return res.status(200).json({ message: 'If the sign-in challenge is valid, a verification code has been sent.' });
  } catch (err) {
    if (err.statusCode === 503) return res.status(503).json({ error: 'Verification email service is temporarily unavailable.' });
    if (!isMissingCustomerAuthFeatureError(err)) console.error('[resendLoginCode] Error:', err.message);
    return res.status(200).json({ message: 'If the sign-in challenge is valid, a verification code has been sent.' });
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
          'UPDATE Customer SET google_sub = ?, is_registered = TRUE, email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE customer_id = ?',
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
        pending = verifyJwt(pendingToken, getJwtSecret());
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
            'UPDATE Customer SET google_sub = ?, date_of_birth = ?, is_registered = TRUE, email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE customer_id = ?',
            [pending.sub, dateOfBirth, customer.user_id]
          );
        } else {
          const [result] = await connection.query(
            `INSERT INTO Customer (first_name, last_name, email, phone_number, address, password_hash, date_of_birth, google_sub, is_registered, email_verified_at)
             VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, TRUE, CURRENT_TIMESTAMP)`,
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
    req.user = verifyJwt(token, getJwtSecret());
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  if (req.user.role === 'customer') return next();

  try {
    let users;
    let passwordColumnsAvailable = true;
    try {
      [users] = await pool.query(
        'SELECT status, is_active, role, password_changed_at FROM Users WHERE user_id = ? LIMIT 1',
        [req.user.user_id]
      );
    } catch (err) {
      if (!isMissingPasswordColumnError(err)) throw err;
      passwordColumnsAvailable = false;
      [users] = await pool.query(
        'SELECT status, is_active, role FROM Users WHERE user_id = ? LIMIT 1',
        [req.user.user_id]
      );
    }

    const staff = users[0];
    if (!staff || staff.status === 'inactive' || !staff.is_active || !STAFF_ROLES.has(staff.role)) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    req.user.role = staff.role;

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
      const payload = verifyJwt(token, getJwtSecret());
      userId = payload.role === 'customer' ? null : (payload.user_id ?? null);
    } catch {
      userId = null;
    }
  }
  writeAuthAudit({ action: ACTIONS.AUTH_LOGOUT, userId, req, newValue: { reason: 'logout' } });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
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
    await writeAuthAudit({
      action: ACTIONS.AUTH_PASSWORD_CHANGE_FAILED,
      userId: req.user.user_id,
      req,
      newValue: { reason: 'missing_password' },
    });
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (!isValidStaffPassword(newPassword, '', '')) {
    await writeAuthAudit({
      action: ACTIONS.AUTH_PASSWORD_CHANGE_FAILED,
      userId: req.user.user_id,
      req,
      newValue: { reason: 'password_policy' },
    });
    return res.status(400).json({ error: 'New password must be 10 to 128 characters, not common, and not match your email or name.' });
  }

  try {
    let users;
    try {
      [users] = await pool.query(
        `SELECT user_id, email, role, full_name, status, is_active, password_hash, must_change_password
         FROM Users WHERE user_id = ? AND role IN (?, ?) LIMIT 1`,
        [req.user.user_id, 'admin', 'receptionist']
      );
    } catch (err) {
      if (!isMissingPasswordColumnError(err)) throw err;
      return res.status(503).json({ error: 'Password changes are unavailable until the database migration is applied.' });
    }

    const user = users[0];
    if (!user || user.status === 'inactive' || !user.is_active) {
      await writeAuthAudit({
        action: ACTIONS.AUTH_PASSWORD_CHANGE_FAILED,
        userId: req.user.user_id,
        req,
        newValue: { reason: 'staff_unavailable' },
      });
      return res.status(401).json({ error: 'Staff account is inactive or no longer exists.' });
    }
    if (!isValidStaffPassword(newPassword, user.email, user.full_name)) {
      await writeAuthAudit({
        action: ACTIONS.AUTH_PASSWORD_CHANGE_FAILED,
        userId: user.user_id,
        req,
        email: user.email,
        newValue: { reason: 'password_policy' },
      });
      return res.status(400).json({ error: 'New password must be 10 to 128 characters, not common, and not match your email or name.' });
    }
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      await writeAuthAudit({
        action: ACTIONS.AUTH_PASSWORD_CHANGE_FAILED,
        userId: user.user_id,
        req,
        email: user.email,
        newValue: { reason: 'current_password_invalid' },
      });
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    if (await bcrypt.compare(newPassword, user.password_hash)) {
      await writeAuthAudit({
        action: ACTIONS.AUTH_PASSWORD_CHANGE_FAILED,
        userId: user.user_id,
        req,
        email: user.email,
        newValue: { reason: 'password_unchanged' },
      });
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
      req,
      email: user.email,
      newValue: { role: user.role, forced: Boolean(user.must_change_password) },
    });
    return res.status(200).json({ message: 'Password changed successfully.', user: publicUser({ ...user, ...updated[0] }) });
  } catch (err) {
    console.error('[changePassword] Error:', err.message);
    await writeAuthAudit({
      action: ACTIONS.AUTH_PASSWORD_CHANGE_FAILED,
      userId: req.user?.user_id ?? null,
      req,
      newValue: { reason: 'password_change_error' },
    });
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
  verifyRegistration,
  resendRegistrationCode,
  verifyLogin,
  resendLoginCode,
  recordStaffLoginThrottle,
  SALT_ROUNDS,
  STAFF_ROLES,
};