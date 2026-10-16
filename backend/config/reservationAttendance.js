const EARLY_CHECKIN_RATE = 500;
const LATE_CHECKOUT_RATE = 500;
const STANDARD_CHECK_IN_HOUR = 14;
const STANDARD_CHECK_OUT_HOUR = 12;
const TIME_ZONE = 'Asia/Manila';
const CLOCK_DRIFT_TOLERANCE_MINUTES = 5;

function getManilaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
}

function formatManilaDateTime(date = new Date()) {
  const parts = getManilaParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function parseLocalDateTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = 0] = timePart.split(':').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
  const parts = getManilaParts(candidate);
  if (`${parts.year}-${parts.month}-${parts.day}` !== datePart || `${parts.hour}:${parts.minute}:${parts.second}` !== `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`) return null;
  return { value, date: candidate, datePart, hour, minute, second };
}

function parseDatabaseDateTime(value) {
  return parseLocalDateTime(String(value).replace(' ', 'T'));
}

function getStandardTime(date, hour) {
  return parseLocalDateTime(`${date}T${String(hour).padStart(2, '0')}:00`);
}

function validateCheckInWindow(actual, reservation) {
  const checkInDate = reservation.check_in_date;
  const checkOutDate = reservation.check_out_date;
  if (actual.datePart < checkInDate) {
    return { status: 400, error: 'Check-in cannot occur before the reservation check-in date.' };
  }

  const scheduledCheckOut = getStandardTime(checkOutDate, STANDARD_CHECK_OUT_HOUR);
  if (!scheduledCheckOut || actual.date.getTime() >= scheduledCheckOut.date.getTime()) {
    return { status: 409, error: "This reservation's check-out time has already passed. Check-in is no longer possible." };
  }

  const checkIn = getStandardTime(checkInDate, STANDARD_CHECK_IN_HOUR);
  const daysLate = Math.max(
    0,
    Math.round((Date.parse(`${actual.datePart}T00:00:00Z`) - Date.parse(`${checkInDate}T00:00:00Z`)) / 86400000)
  );
  return { daysLate, isLate: daysLate > 0, checkIn };
}

function calculateAttendanceFee(action, actual, reservation) {
  const standard = getStandardTime(
    action === 'check-in' ? reservation.check_in_date : reservation.check_out_date,
    action === 'check-in' ? STANDARD_CHECK_IN_HOUR : STANDARD_CHECK_OUT_HOUR
  );
  if (!standard || !actual) {
    throw Object.assign(new Error('Invalid reservation or actual time for attendance fee.'), { status: 500 });
  }
  const differenceMinutes = Math.max(0, Math.ceil((actual.date.getTime() - standard.date.getTime()) / 60000));
  const hoursCharged = action === 'check-in'
    ? Math.ceil(Math.max(0, (standard.date.getTime() - actual.date.getTime()) / 3600000))
    : Math.ceil(differenceMinutes / 60);
  const rate = action === 'check-in' ? EARLY_CHECKIN_RATE : LATE_CHECKOUT_RATE;
  return { fee: hoursCharged * rate, hoursCharged, rate };
}

module.exports = {
  EARLY_CHECKIN_RATE,
  LATE_CHECKOUT_RATE,
  STANDARD_CHECK_IN_HOUR,
  STANDARD_CHECK_OUT_HOUR,
  TIME_ZONE,
  CLOCK_DRIFT_TOLERANCE_MINUTES,
  formatManilaDateTime,
  parseLocalDateTime,
  parseDatabaseDateTime,
  validateCheckInWindow,
  calculateAttendanceFee,
};