const pool = require('../config/db');

const MANILA_OFFSET = '+08:00';
const ACTIVE_RESERVATION_STATUSES = ['confirmed', 'checked_in', 'completed'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function getManilaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
}

function getManilaToday() {
  const { year, month, day } = getManilaDateParts();
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || formatDate(date) !== value ? null : date;
}

function getReportDateRange(query = {}) {
  const { year, month } = getManilaDateParts();
  const defaultStart = formatDate(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
  const defaultEnd = formatDate(new Date(Date.UTC(Number(year), Number(month), 0)));
  const startDate = query.start_date || defaultStart;
  const endDate = query.end_date || defaultEnd;
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) return { error: 'start_date and end_date must use YYYY-MM-DD format.' };
  if (start > end) return { error: 'start_date cannot be after end_date.' };

  const endExclusive = new Date(end);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + end.getUTCMonth() - start.getUTCMonth() + 1;
  if (months > 24) return { error: 'The report range cannot exceed 24 months.' };

  return {
    startDate,
    endDate,
    endExclusive: formatDate(endExclusive),
    days: Math.round((endExclusive - start) / 86400000),
    start,
    end,
  };
}

function percent(value, total) {
  return total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function fromCents(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

async function getVerifiedPaymentRows({ startDate, endExclusive, includeGuest = false }) {
  const paymentColumns = await getTableColumns('Payments', ['verified_at', 'payment_type']);
  const revenueDateField = paymentColumns.has('verified_at') ? 'p.verified_at' : 'p.created_at';
  const paymentTypeSelect = paymentColumns.has('payment_type') ? 'p.payment_type' : "'full'";
  const guestSelect = includeGuest ? ', c.first_name, c.last_name' : '';
  const [rows] = await pool.query(
    `SELECT p.payment_id, p.amount, ${paymentTypeSelect} AS payment_type,
            pm.method_name, r.booking_reference, r.booking_source,
            ${revenueDateField} AS revenue_date, r.room_id, r.venue_id
            ${guestSelect}
     FROM Payments p
     INNER JOIN Reservations r ON r.reservation_id = p.reservation_id
     INNER JOIN PaymentMethods pm ON pm.payment_method_id = p.payment_method_id
     ${includeGuest ? 'LEFT JOIN Customer c ON c.customer_id = r.customer_id' : ''}
     WHERE p.payment_status = 'verified'
       AND ${revenueDateField} >= CONVERT_TZ(?, ?, '+00:00')
       AND ${revenueDateField} < CONVERT_TZ(?, ?, '+00:00')
     ORDER BY ${revenueDateField}, p.payment_id`,
    [`${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET]
  );
  return { rows, revenueDateField: paymentColumns.has('verified_at') ? 'verified_at' : 'created_at' };
}

function buildMonths(start, end) {
  const months = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const spansYears = start.getUTCFullYear() !== end.getUTCFullYear();
  while (cursor <= last) {
    const key = `${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}`;
    const month = cursor.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    months.push({ key, label: spansYears ? `${month} ${cursor.getUTCFullYear()}` : month });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function getMonthRangeEndingToday(monthCount = 6) {
  const { year, month } = getManilaDateParts();
  const end = new Date(Date.UTC(Number(year), Number(month), 0));
  const start = new Date(Date.UTC(Number(year), Number(month) - monthCount + 1, 1));
  return {
    startDate: formatDate(start),
    endExclusive: formatDate(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1))),
    start,
    end,
    months: buildMonths(start, end),
  };
}

async function getTableColumns(tableName, columnNames) {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME IN (?)`,
    [tableName, columnNames]
  );
  return new Set(columns.map(({ COLUMN_NAME: name }) => name));
}

async function getAttendanceColumns() {
  const names = await getTableColumns('Reservations', ['early_checkin_fee', 'late_checkout_fee', 'fees_collected_at']);
  return { available: names.size === 3, names };
}

function buildRoomOccupancyQuery({ startDate, endExclusive, statuses, activeOnly = false }) {
  const placeholders = statuses.map(() => '?').join(', ');
  const roomJoin = activeOnly ? "INNER JOIN Rooms rm ON rm.room_id = r.room_id AND rm.status = 'available'" : '';
  return {
    sql: `SELECT r.room_id,
                 DATEDIFF(LEAST(r.check_out_date, ?), GREATEST(r.check_in_date, ?)) AS clipped_nights
          FROM Reservations r
          ${roomJoin}
          WHERE r.room_id IS NOT NULL
            AND r.status IN (${placeholders})
            AND r.check_in_date < ?
            AND r.check_out_date > ?`,
    params: [endExclusive, startDate, ...statuses, endExclusive, startDate],
  };
}

module.exports = {
  ACTIVE_RESERVATION_STATUSES,
  MANILA_OFFSET,
  buildMonths,
  buildRoomOccupancyQuery,
  formatDate,
  getAttendanceColumns,
  getVerifiedPaymentRows,
  fromCents,
  getManilaDateParts,
  getManilaToday,
  getMonthRangeEndingToday,
  getReportDateRange,
  getTableColumns,
  parseDate,
  percent,
  toCents,
};