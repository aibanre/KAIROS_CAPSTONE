const MANILA_TIME_ZONE = 'Asia/Manila';
const MAX_AGE_YEARS = 120;

function todayInManila(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseDateOfBirth(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

function validateAdultDateOfBirth(value, now = new Date()) {
  const parsed = parseDateOfBirth(value);
  const today = todayInManila(now);
  if (!parsed) return { valid: false, reason: 'invalid' };
  if (value > today) return { valid: false, reason: 'future' };

  const todayParts = today.split('-').map(Number);
  let age = todayParts[0] - parsed.year;
  if (
    todayParts[1] < parsed.month
    || (todayParts[1] === parsed.month && todayParts[2] < parsed.day)
  ) age -= 1;

  if (age < 18) return { valid: false, reason: 'underage', age };
  if (age > MAX_AGE_YEARS) return { valid: false, reason: 'too_old', age };
  return { valid: true, age };
}

module.exports = { parseDateOfBirth, todayInManila, validateAdultDateOfBirth };
