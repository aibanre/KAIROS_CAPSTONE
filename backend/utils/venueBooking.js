const { ACTIVE_HOLD_CLAUSE, statusPlaceholders, statusParams } = require('./reservationAvailability');

const MANILA = 'Asia/Manila';

function minutes(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const result = Number(match[1]) * 60 + Number(match[2]);
  return result >= 0 && result < 1440 ? result : null;
}

function timeValue(value) {
  const result = minutes(value);
  return result === null ? null : `${String(Math.floor(result / 60)).padStart(2, '0')}:${String(result % 60).padStart(2, '0')}:00`;
}

function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MANILA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function parseInclusions(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseInclusions(parsed);
  } catch (error) {
    // Support legacy newline/comma-separated package values.
  }
  return String(value).split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}

function computeWindow(venue, startTime, extraHours = 0) {
  const start = minutes(startTime);
  if (start === null) return null;
  if (venue.booking_mode === 'day_use') {
    const end = minutes(venue.end_time || '17:00');
    return { start, end, extraHours: 0 };
  }
  const packageHours = Number(venue._included_hours || 5);
  const end = start + (packageHours + Number(extraHours)) * 60;
  return { start, end, extraHours: Number(extraHours) };
}

function validateBooking(venue, pkg, date, startTime, pax, extraHours = 0) {
  if (!venue) return { valid: false, reason: 'Venue not found.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || date < manilaToday()) return { valid: false, reason: 'Bookings must be for today or a future date.' };
  const start = minutes(startTime);
  if (start === null) return { valid: false, reason: 'Start time must use HH:mm.' };
  const rulesStart = minutes(venue.booking_mode === 'day_use' ? (venue.start_time || '08:00') : (venue.earliest_start || '08:00'));
  const rulesEnd = minutes(venue.booking_mode === 'day_use' ? (venue.end_time || '17:00') : (venue.latest_end || '22:00'));
  const step = Number(venue.slot_step_minutes || 30);
  if (start < rulesStart || start % step !== rulesStart % step) return { valid: false, reason: 'Start time is outside the venue schedule.' };
  if (date === manilaToday()) {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: MANILA }));
    if (start <= now.getHours() * 60 + now.getMinutes()) return { valid: false, reason: 'Start time has already passed.' };
  }
  if (venue.booking_mode === 'packaged') {
    if (!pkg || !pkg.is_active) return { valid: false, reason: 'A valid active package is required.' };
    const count = Number(pax);
    if (!Number.isInteger(count) || count < Number(pkg.min_pax) || (pkg.max_pax !== null && count > Number(pkg.max_pax))) return { valid: false, reason: `Pax must be between ${pkg.min_pax} and ${pkg.max_pax || venue.capacity}.` };
  } else if (Number(pax) > Number(venue.capacity)) {
    return { valid: false, reason: `Pax cannot exceed the venue capacity of ${venue.capacity}.` };
  }
  if (!Number.isInteger(Number(extraHours)) || Number(extraHours) < 0) return { valid: false, reason: 'Extra hours must be a non-negative whole number.' };
  const window = computeWindow({ ...venue, _included_hours: pkg?.included_hours }, startTime, extraHours);
  if (!window || window.end > rulesEnd || window.end <= window.start) return { valid: false, reason: 'The requested time window exceeds the venue schedule.' };
  return {
    valid: true,
    start: window.start,
    end: window.end,
    startTime: timeValue(startTime),
    endTime: `${String(Math.floor(window.end / 60)).padStart(2, '0')}:${String(window.end % 60).padStart(2, '0')}:00`,
    durationHours: (window.end - window.start) / 60,
  };
}

function computePrice(venue, pkg, pax, extraHours = 0) {
  if (venue.booking_mode === 'day_use') {
    const total = Number(venue.flat_price || 0);
    return { unit_price: total, pricing_type: 'flat', base_amount: total, extra_hours: 0, extra_amount: 0, total };
  }
  const unit = Number(pkg.price);
  const base = pkg.pricing_type === 'per_person' ? unit * Number(pax) : unit;
  const extra = Number(extraHours) * Number(pkg.extra_hour_rate || 0);
  return { unit_price: unit, pricing_type: pkg.pricing_type, base_amount: base, extra_hours: Number(extraHours), extra_amount: extra, total: base + extra };
}

async function findConflicts(executor, venueId, date, start, end, bufferMinutes = 0, excludeReservationId = null, { forUpdate = false } = {}) {
  const excludedReservationIds = Array.isArray(excludeReservationId)
    ? excludeReservationId
    : excludeReservationId === null || excludeReservationId === undefined
      ? []
      : [excludeReservationId];
  const exclusion = excludedReservationIds.length === 0
    ? ''
    : ` AND reservation_id NOT IN (${excludedReservationIds.map(() => '?').join(', ')})`;
  const params = [venueId, date, ...statusParams()];
  params.push(...excludedReservationIds);
  const [rows] = await executor.query(
    `SELECT reservation_id, start_time, end_time FROM Reservations
     WHERE venue_id = ? AND event_date = ? AND status IN (${statusPlaceholders()})
       AND ${ACTIVE_HOLD_CLAUSE}
       ${exclusion}${forUpdate ? ' FOR UPDATE' : ''}`,
    params
  );
  return rows.filter((row) => {
    const existingStart = minutes(row.start_time);
    const existingEnd = minutes(row.end_time);
    return existingStart !== null && existingEnd !== null
      && existingStart < end + Number(bufferMinutes || 0)
      && existingEnd > start - Number(bufferMinutes || 0);
  });
}

async function hasAvailableVenueSlot(executor, venue, date, excludeReservationId = null) {
  if (venue.booking_mode === 'day_use') {
    const booking = validateBooking(venue, null, date, timeValue(venue.start_time || '08:00'), 1, 0);
    if (!booking.valid) return false;
    const conflicts = await findConflicts(executor, venue.venue_id, date, booking.start, booking.end, Number(venue.buffer_minutes || 0), excludeReservationId);
    return conflicts.length === 0;
  }

  const [packages] = await executor.query(
    'SELECT * FROM Venue_Packages WHERE venue_id = ? AND is_active = TRUE ORDER BY sort_order, package_id',
    [venue.venue_id]
  );
  const earliest = minutes(venue.earliest_start || '08:00');
  const latest = minutes(venue.latest_end || '22:00');
  const step = Number(venue.slot_step_minutes || 30);
  for (const pkg of packages) {
    for (let start = earliest; start < latest; start += step) {
      const booking = validateBooking(
        venue,
        pkg,
        date,
        timeValue(`${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`),
        Number(pkg.min_pax || 1),
        0
      );
      if (!booking.valid) continue;
      const conflicts = await findConflicts(executor, venue.venue_id, date, booking.start, booking.end, Number(venue.buffer_minutes || 0), excludeReservationId);
      if (conflicts.length === 0) return true;
    }
  }
  return false;
}

module.exports = { minutes, timeValue, parseInclusions, validateBooking, computePrice, findConflicts, hasAvailableVenueSlot };
