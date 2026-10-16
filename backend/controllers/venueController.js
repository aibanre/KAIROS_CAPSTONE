const pool = require('../config/db');
const { ACTIVE_HOLD_CLAUSE, statusPlaceholders, statusParams } = require('../utils/reservationAvailability');
const { verifyReservationToken } = require('../utils/reservationToken');
const { parseInclusions, minutes, validateBooking, computePrice, hasAvailableVenueSlot } = require('../utils/venueBooking');
const { REVIEW_STATS_SELECT, reviewStatsJoin, queryWithReviewStats } = require('../utils/reviewStats');
const { isBeforeEarliestBookableDate, earliestBookingMessage } = require('../utils/reservationDates');
const { getVenueGroup } = require('../utils/resourceGroups');

const VENUE_PRICE_SELECT = `CASE WHEN v.booking_mode = 'packaged' THEN (
  SELECT MIN(vp.price)
  FROM Venue_Packages vp
  WHERE vp.venue_id = v.venue_id AND vp.is_active = TRUE
) ELSE v.flat_price END AS price`;

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function authorizedHoldId(req, venueId, eventDate, venueIds = [venueId], includeDate = false) {
  const holdId = Number(req.query.hold_id);
  if (!Number.isInteger(holdId) || holdId <= 0) return null;

  const token = req.headers['x-reservation-token'];
  const tokenPayload = typeof token === 'string' ? verifyReservationToken(token) : null;
  const isCustomerOwner = req.user?.role === 'customer';
  const isGuestOwner = Number(tokenPayload?.reservation_id) === holdId;
  if (!isCustomerOwner && !isGuestOwner) return null;

  const ownership = isCustomerOwner ? 'customer_id = ?' : 'reservation_id = ?';
  const ownerId = isCustomerOwner ? req.user.user_id : holdId;
  const dateClause = eventDate ? ' AND event_date = ?' : '';
  const params = [holdId, ...venueIds];
  if (eventDate) params.push(eventDate);
  params.push(ownerId);
  const [[hold]] = await pool.query(
    `SELECT reservation_id, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date
     FROM Reservations
     WHERE reservation_id = ? AND venue_id IN (${venueIds.map(() => '?').join(',')})${dateClause}
       AND ${ownership} AND status = 'payment_pending'
       AND (hold_expires_at IS NULL OR hold_expires_at >= NOW())`,
    params
  );
  return hold ? (includeDate ? hold : hold.reservation_id) : null;
}

async function listVenues(req, res) {
  try {
    const venues = await queryWithReviewStats(
      `SELECT v.*, ${VENUE_PRICE_SELECT}, ${REVIEW_STATS_SELECT}
       FROM Venues v
       ${reviewStatsJoin('venue_id')}
       WHERE v.status = 'available'
       ORDER BY v.venue_name ASC`,
      `SELECT v.*, ${VENUE_PRICE_SELECT} FROM Venues v WHERE v.status = 'available' ORDER BY v.venue_name ASC`
    );

    return res.status(200).json({ venues });
  } catch (err) {
    console.error('[listVenues] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch venues.' });
  }
}

async function getVenue(req, res) {
  try {
    if (req.query.group === '1') {
      const group = await getVenueGroup(pool, req.params.id);
      if (!group) return res.status(404).json({ error: 'Venue not found.' });
      const availableUnit = group.groupUnits.find((unit) => unit.status === 'available');
      if (!availableUnit) return res.status(404).json({ error: 'Venue not found.' });
      const venues = await queryWithReviewStats(
        `SELECT v.*, ${VENUE_PRICE_SELECT}, ${REVIEW_STATS_SELECT}
         FROM Venues v
         ${reviewStatsJoin('venue_id')}
         WHERE v.venue_id = ? AND v.status = 'available'`,
        `SELECT v.*, ${VENUE_PRICE_SELECT} FROM Venues v WHERE v.venue_id = ? AND v.status = 'available'`,
        [availableUnit.venue_id],
      );
      if (!venues.length) return res.status(404).json({ error: 'Venue not found.' });
      return res.status(200).json({ venue: venues[0] });
    }
    const venues = await queryWithReviewStats(
      `SELECT v.*, ${VENUE_PRICE_SELECT}, ${REVIEW_STATS_SELECT}
       FROM Venues v
       ${reviewStatsJoin('venue_id')}
       WHERE v.venue_id = ? AND v.status = 'available'`,
      `SELECT v.*, ${VENUE_PRICE_SELECT} FROM Venues v WHERE v.venue_id = ? AND v.status = 'available'`,
      [req.params.id]
    );

    if (venues.length === 0) {
      return res.status(404).json({ error: 'Venue not found.' });
    }

    return res.status(200).json({ venue: venues[0] });
  } catch (err) {
    console.error('[getVenue] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch venue.' });
  }
}

async function getBookedDates(req, res) {
  const year = Number(req.query.year); const month = Number(req.query.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ error: 'Valid year and month are required.' });
  try {
    if (req.query.group === '1') {
      const group = await getVenueGroup(pool, req.params.id);
      if (!group) return res.status(404).json({ error: 'Venue not found.' });
      if (group.booking_mode !== 'day_use') return res.status(400).json({ error: 'Grouped availability is only available for day-use venues.' });
      const units = group.groupUnits;
      const authorizedHold = await authorizedHoldId(
        req,
        req.params.id,
        req.query.date || '',
        units.map((unit) => unit.venue_id),
        true,
      );
      const lastDay = new Date(year, month, 0).getDate();
      const booked_dates = [];
      for (let day = 1; day <= lastDay; day += 1) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        let hasAvailableUnit = false;
        for (const unit of units) {
          if (unit.status !== 'available') continue;
          const excludeReservationId = authorizedHold
            && dateOnly(authorizedHold.event_date) === date
            ? authorizedHold.reservation_id
            : null;
          if (await hasAvailableVenueSlot(pool, unit, date, excludeReservationId)) {
            hasAvailableUnit = true;
            break;
          }
        }
        if (!hasAvailableUnit) booked_dates.push(date);
      }
      return res.json({ booked_dates });
    }
    const [[venue]] = await pool.query("SELECT * FROM Venues WHERE venue_id = ? AND status = 'available'", [req.params.id]);
    if (!venue) return res.status(404).json({ error: 'Venue not found.' });
    const excludeReservationId = await authorizedHoldId(req, req.params.id, req.query.date || '');
    const lastDay = new Date(year, month, 0).getDate();
    const bookedDates = [];
    for (let day = 1; day <= lastDay; day += 1) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!(await hasAvailableVenueSlot(pool, venue, date, excludeReservationId))) bookedDates.push(date);
    }
    return res.json({ booked_dates: bookedDates });
  } catch (err) { return res.status(500).json({ error: 'Failed to fetch venue availability.' }); }
}

async function getPackages(req, res) {
  try {
    const [packages] = await pool.query('SELECT * FROM Venue_Packages WHERE venue_id = ? AND is_active = TRUE ORDER BY sort_order, package_id', [req.params.id]);
    return res.set('Cache-Control', 'no-store').json({ packages: packages.map((pkg) => ({ ...pkg, inclusions: parseInclusions(pkg.inclusions) })) });
  } catch (err) { return res.status(500).json({ error: 'Failed to fetch venue packages.' }); }
}

async function getAvailability(req, res) {
  const date = String(req.query.date || '');
  if (isBeforeEarliestBookableDate(date)) return res.status(400).json({ error: earliestBookingMessage() });
  try {
    const [[venue]] = await pool.query("SELECT * FROM Venues WHERE venue_id = ? AND status = 'available'", [req.params.id]);
    if (!venue) return res.status(404).json({ error: 'Venue not found.' });
    const excludeReservationId = await authorizedHoldId(req, req.params.id, date);
    const exclusion = excludeReservationId === null ? '' : ' AND reservation_id <> ?';
    const params = [req.params.id, date, ...statusParams()];
    if (exclusion) params.push(excludeReservationId);
    const [rows] = await pool.query(
      `SELECT TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i') AS end_time
       FROM Reservations WHERE venue_id = ? AND event_date = ? AND status IN (${statusPlaceholders()}) AND ${ACTIVE_HOLD_CLAUSE}${exclusion} ORDER BY start_time`,
      params
    );
    const earliest = minutes(venue.booking_mode === 'day_use' ? (venue.start_time || '08:00') : (venue.earliest_start || '08:00'));
    const latest = minutes(venue.booking_mode === 'day_use' ? (venue.end_time || '17:00') : (venue.latest_end || '22:00'));
    const step = Number(venue.slot_step_minutes || 30);
    const valid_start_times = [];
    for (let value = earliest; value < latest; value += step) valid_start_times.push(`${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`);
    return res.json({ booked_ranges: rows, valid_start_times });
  } catch (err) { return res.status(500).json({ error: 'Failed to fetch venue availability.' }); }
}

async function quote(req, res) {
  if (isBeforeEarliestBookableDate(String(req.query.date || ''))) {
    return res.status(400).json({ error: earliestBookingMessage() });
  }
  try {
    const [[venue]] = await pool.query("SELECT * FROM Venues WHERE venue_id = ? AND status = 'available'", [req.params.id]);
    if (!venue) return res.status(404).json({ valid: false, reason: 'Venue not found.' });
    const [[pkg]] = req.query.package_id ? await pool.query('SELECT * FROM Venue_Packages WHERE package_id = ? AND venue_id = ? AND is_active = TRUE', [req.query.package_id, req.params.id]) : [[]];
    const validation = validateBooking(venue, pkg, req.query.date, req.query.start, req.query.pax, Number(req.query.extra_hours || 0));
    if (!validation.valid) return res.json(validation);
    const excludeReservationId = await authorizedHoldId(req, req.params.id, req.query.date);
    const conflict = await require('../utils/venueBooking').findConflicts(pool, req.params.id, req.query.date, validation.start, validation.end, Number(venue.buffer_minutes || 0), excludeReservationId);
    if (conflict.length) return res.json({ valid: false, reason: 'That time slot is no longer available.' });
    const breakdown = computePrice(venue, pkg, req.query.pax, Number(req.query.extra_hours || 0));
    return res.json({ valid: true, total: breakdown.total, breakdown, ...validation });
  } catch (err) { return res.status(500).json({ valid: false, reason: 'Failed to calculate venue quote.' }); }
}

module.exports = { listVenues, getVenue, getBookedDates, getPackages, getAvailability, quote };