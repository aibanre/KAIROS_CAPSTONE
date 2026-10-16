const COMMON_STAFF_PASSWORDS = new Set([
  '1234567890',
  'password',
  'password123',
  'qwerty',
  'qwerty123',
  'admin',
  'admin123',
  'admin12345',
  'letmein',
  'letmein123',
  'welcome',
  'welcome123',
  'iloveyou',
]);

function isValidStaffPassword(password, email, fullName) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) return false;
  const normalizedPassword = password.toLowerCase();
  if (normalizedPassword === String(email || '').trim().toLowerCase()
    || normalizedPassword === String(fullName || '').trim().toLowerCase()) return false;
  return !COMMON_STAFF_PASSWORDS.has(normalizedPassword);
}

module.exports = { isValidStaffPassword };
