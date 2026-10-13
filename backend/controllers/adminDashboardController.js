const pool = require('../config/db');
const { PLACEHOLDER_CUSTOMER_MARKER } = require('../config/reservationConfig');
const {
  ACTIVE_RESERVATION_STATUSES,
  MANILA_OFFSET,
  buildRoomOccupancyQuery,
  formatDate,
  getAttendanceColumns,
  getManilaDateParts,
  getMonthRangeEndingToday,
  getTableColumns,
  percent,
} = require('../utils/reportMetrics');
const { getPaymentSummary } = require('../utils/paymentSummary');

const DASHBOARD_OCCUPANCY_STATUSES = ['confirmed', 'checked_in'];
const PENDING_PAYMENT_STATUS = 'pending_verification';

function toNumber(value) {
  return Number(value || 0);
}

function getTodayRange() {
  const { year, month, day } = getManilaDateParts();
  const start = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { date: `${year}-${month}-${day}`, endExclusive: formatDate(end) };
}

function getNinetyDayRange(today) {
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 89);
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startDate: formatDate(start), endExclusive: formatDate(end) };
}

async function getSnapshot(today, endExclusive) {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM Reservations r WHERE r.room_id IS NOT NULL AND r.status = 'confirmed' AND r.check_in_date = ?) AS arrivals,
       (SELECT COUNT(*) FROM Reservations r WHERE r.room_id IS NOT NULL AND r.status = 'checked_in' AND r.check_out_date = ?) AS departures,
       (SELECT COUNT(*) FROM Reservations r WHERE r.status = 'checked_in') AS checked_in_guests,
       (SELECT COUNT(*) FROM Reservations r WHERE r.venue_id IS NOT NULL AND r.status IN (?, ?, ?) AND r.event_date = ?) AS venue_events,
       (SELECT COUNT(*) FROM Reservations r WHERE r.room_id IS NOT NULL AND r.status = 'confirmed' AND r.check_in_date < ?) AS overdue_arrivals,
       (SELECT COUNT(*) FROM Reservations r WHERE r.room_id IS NOT NULL AND r.status = 'checked_in' AND r.check_out_date < ?) AS overdue_departures`,
    [today, today, ...ACTIVE_RESERVATION_STATUSES, today, today, today]
  );

  const occupancyQuery = buildRoomOccupancyQuery({
    startDate: today,
    endExclusive,
    statuses: DASHBOARD_OCCUPANCY_STATUSES,
    activeOnly: true,
  });
  const [[occupancyRows], [activeRoomRows]] = await Promise.all([
    pool.query(occupancyQuery.sql, occupancyQuery.params),
    pool.query(`SELECT COUNT(*) AS active_rooms FROM Rooms WHERE status = 'available'`),
  ]);
  const occupiedRoomIds = new Set(occupancyRows.map((row) => row.room_id));
  const activeRooms = toNumber(activeRoomRows[0]?.active_rooms);
  const occupiedRooms = Math.min(activeRooms, occupiedRoomIds.size);

  return {
    snapshot: rows[0] || {},
    occupancy: {
      occupied_rooms: occupiedRooms,
      available_rooms: Math.max(0, activeRooms - occupiedRooms),
      active_rooms: activeRooms,
      occupied_percentage: percent(occupiedRooms, activeRooms),
      available_percentage: percent(Math.max(0, activeRooms - occupiedRooms), activeRooms),
    },
  };
}

async function getRevenue(today, monthStart, monthEndExclusive) {
  const [paymentColumns, attendanceColumns] = await Promise.all([
    getTableColumns('Payments', ['verified_at']),
    getAttendanceColumns(),
  ]);
  const revenueDateField = paymentColumns.has('verified_at') ? 'p.verified_at' : 'p.created_at';
  const [[revenueRows], [feeRows], [outstandingRows]] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN ${revenueDateField} >= CONVERT_TZ(?, ?, '+00:00') AND ${revenueDateField} < CONVERT_TZ(?, ?, '+00:00') THEN p.amount ELSE 0 END), 0) AS today_revenue,
         COALESCE(SUM(CASE WHEN ${revenueDateField} >= CONVERT_TZ(?, ?, '+00:00') AND ${revenueDateField} < CONVERT_TZ(?, ?, '+00:00') THEN p.amount ELSE 0 END), 0) AS month_revenue
       FROM Payments p
       INNER JOIN Reservations r ON r.reservation_id = p.reservation_id
       WHERE p.payment_status = 'verified'
         AND ${revenueDateField} >= CONVERT_TZ(?, ?, '+00:00')
         AND ${revenueDateField} < CONVERT_TZ(?, ?, '+00:00')`,
      [`${today} 00:00:00`, MANILA_OFFSET, `${today} 00:00:00`, MANILA_OFFSET,
        `${monthStart} 00:00:00`, MANILA_OFFSET, `${monthEndExclusive} 00:00:00`, MANILA_OFFSET,
        `${monthStart} 00:00:00`, MANILA_OFFSET, `${monthEndExclusive} 00:00:00`, MANILA_OFFSET]
    ),
    attendanceColumns.available
      ? pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN r.fees_collected_at >= CONVERT_TZ(?, ?, '+00:00') AND r.fees_collected_at < CONVERT_TZ(?, ?, '+00:00') THEN r.early_checkin_fee + r.late_checkout_fee ELSE 0 END), 0) AS today_fees,
           COALESCE(SUM(CASE WHEN r.fees_collected_at >= CONVERT_TZ(?, ?, '+00:00') AND r.fees_collected_at < CONVERT_TZ(?, ?, '+00:00') THEN r.early_checkin_fee + r.late_checkout_fee ELSE 0 END), 0) AS month_fees
         FROM Reservations r
         WHERE r.fees_collected_at >= CONVERT_TZ(?, ?, '+00:00')
           AND r.fees_collected_at < CONVERT_TZ(?, ?, '+00:00')`,
        [`${today} 00:00:00`, MANILA_OFFSET, `${today} 00:00:00`, MANILA_OFFSET,
          `${monthStart} 00:00:00`, MANILA_OFFSET, `${monthEndExclusive} 00:00:00`, MANILA_OFFSET,
          `${monthStart} 00:00:00`, MANILA_OFFSET, `${monthEndExclusive} 00:00:00`, MANILA_OFFSET]
      )
      : Promise.resolve([[{ today_fees: 0, month_fees: 0 }]]),
    pool.query(`SELECT reservation_id FROM Reservations WHERE status IN ('confirmed', 'checked_in')`),
  ]);

  const outstanding = await Promise.all(outstandingRows.map((row) => getPaymentSummary(pool, row.reservation_id)));

  return {
    today: toNumber(revenueRows[0]?.today_revenue),
    current_month: toNumber(revenueRows[0]?.month_revenue),
    revenue_date_field: paymentColumns.has('verified_at') ? 'verified_at' : 'created_at',
    attendance_fees: {
      today: toNumber(feeRows[0]?.today_fees),
      current_month: toNumber(feeRows[0]?.month_fees),
      fees_available: attendanceColumns.available,
    },
    outstanding_balances: {
      amount: outstanding.reduce((sum, summary) => sum + (summary?.balance_due || 0), 0),
      reservations: outstanding.filter((summary) => summary?.balance_due > 0).length,
    },
  };
}

async function getActionItems(today) {
  const [[pendingRows], [overdueArrivals], [overdueDepartures]] = await Promise.all([
    pool.query(
      `SELECT r.booking_reference, c.first_name, c.last_name, pm.method_name,
              p.amount, p.created_at
       FROM Payments p
       INNER JOIN Reservations r ON r.reservation_id = p.reservation_id
       LEFT JOIN Customer c ON c.customer_id = r.customer_id
       INNER JOIN PaymentMethods pm ON pm.payment_method_id = p.payment_method_id
       WHERE p.payment_status = ?
         AND (c.first_name IS NULL OR c.first_name <> ?)
       ORDER BY p.created_at ASC
       LIMIT 5`,
      [PENDING_PAYMENT_STATUS, PLACEHOLDER_CUSTOMER_MARKER]
    ),
    pool.query(
      `SELECT r.booking_reference, c.first_name, c.last_name, r.check_in_date,
              rm.room_number
       FROM Reservations r
       LEFT JOIN Customer c ON c.customer_id = r.customer_id
       LEFT JOIN Rooms rm ON rm.room_id = r.room_id
       WHERE r.room_id IS NOT NULL
         AND r.status = 'confirmed'
         AND r.check_in_date < ?
         AND (c.first_name IS NULL OR c.first_name <> ?)
       ORDER BY r.check_in_date ASC, r.booking_reference ASC
       LIMIT 5`,
      [today, PLACEHOLDER_CUSTOMER_MARKER]
    ),
    pool.query(
      `SELECT r.booking_reference, c.first_name, c.last_name, r.check_out_date,
              rm.room_number
       FROM Reservations r
       LEFT JOIN Customer c ON c.customer_id = r.customer_id
       LEFT JOIN Rooms rm ON rm.room_id = r.room_id
       WHERE r.room_id IS NOT NULL
         AND r.status = 'checked_in'
         AND r.check_out_date < ?
         AND (c.first_name IS NULL OR c.first_name <> ?)
       ORDER BY r.check_out_date ASC, r.booking_reference ASC
       LIMIT 5`,
      [today, PLACEHOLDER_CUSTOMER_MARKER]
    ),
  ]);

  const mapGuest = (row) => ({ ...row, guest: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Guest' });
  return {
    pending_payments: {
      count: await countPendingPayments(),
      oldest: pendingRows.map((row) => ({ ...mapGuest(row), method: row.method_name, amount: toNumber(row.amount) })),
    },
    overdue_arrivals: { count: await countOverdueArrivals(today), reservations: overdueArrivals.map(mapGuest) },
    overdue_departures: { count: await countOverdueDepartures(today), reservations: overdueDepartures.map(mapGuest) },
  };
}

async function countPendingPayments() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM Payments p
     INNER JOIN Reservations r ON r.reservation_id = p.reservation_id
     LEFT JOIN Customer c ON c.customer_id = r.customer_id
     WHERE p.payment_status = ?
       AND (c.first_name IS NULL OR c.first_name <> ?)`,
    [PENDING_PAYMENT_STATUS, PLACEHOLDER_CUSTOMER_MARKER]
  );
  return toNumber(rows[0]?.count);
}

async function countOverdueArrivals(today) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM Reservations r
     LEFT JOIN Customer c ON c.customer_id = r.customer_id
     WHERE r.room_id IS NOT NULL AND r.status = 'confirmed' AND r.check_in_date < ?
       AND (c.first_name IS NULL OR c.first_name <> ?)`,
    [today, PLACEHOLDER_CUSTOMER_MARKER]
  );
  return toNumber(rows[0]?.count);
}

async function countOverdueDepartures(today) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM Reservations r
     LEFT JOIN Customer c ON c.customer_id = r.customer_id
     WHERE r.room_id IS NOT NULL AND r.status = 'checked_in' AND r.check_out_date < ?
       AND (c.first_name IS NULL OR c.first_name <> ?)`,
    [today, PLACEHOLDER_CUSTOMER_MARKER]
  );
  return toNumber(rows[0]?.count);
}

async function getBookingTrend(startDate, endExclusive, months) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(CONVERT_TZ(r.created_at, '+00:00', ?), '%Y-%m') AS month_key, COUNT(*) AS bookings
     FROM Reservations r
     WHERE r.status IN (?, ?, ?)
       AND r.created_at >= CONVERT_TZ(?, ?, '+00:00')
       AND r.created_at < CONVERT_TZ(?, ?, '+00:00')
     GROUP BY month_key`,
    [MANILA_OFFSET, ...ACTIVE_RESERVATION_STATUSES, `${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET]
  );
  const counts = new Map(rows.map((row) => [row.month_key, toNumber(row.bookings)]));
  return months.map(({ key, label }) => ({ month: label, bookings: counts.get(key) || 0 }));
}

async function getPopular(startDate, endExclusive) {
  const [rows] = await pool.query(
    `SELECT r.room_id, r.venue_id, rm.room_number, v.venue_name, COUNT(*) AS bookings
     FROM Reservations r
     LEFT JOIN Rooms rm ON rm.room_id = r.room_id
     LEFT JOIN Venues v ON v.venue_id = r.venue_id
     WHERE r.status IN (?, ?, ?)
       AND r.created_at >= CONVERT_TZ(?, ?, '+00:00')
       AND r.created_at < CONVERT_TZ(?, ?, '+00:00')
    GROUP BY r.room_id, r.venue_id, rm.room_number, v.venue_name
    ORDER BY bookings DESC, COALESCE(rm.room_number, v.venue_name) ASC`,
    [...ACTIVE_RESERVATION_STATUSES, `${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET]
  );
  return {
    rooms: rows.filter((row) => row.room_id).slice(0, 5).map((row) => ({ name: row.room_number, bookings: toNumber(row.bookings) })),
    venues: rows.filter((row) => row.venue_id).slice(0, 5).map((row) => ({ name: row.venue_name, bookings: toNumber(row.bookings) })),
  };
}

async function getRecentReservations() {
  const [rows] = await pool.query(
    `SELECT r.booking_reference, c.first_name, c.last_name, rm.room_number, v.venue_name,
            r.status, r.booking_source
     FROM Reservations r
     LEFT JOIN Customer c ON c.customer_id = r.customer_id
     LEFT JOIN Rooms rm ON rm.room_id = r.room_id
     LEFT JOIN Venues v ON v.venue_id = r.venue_id
     ORDER BY r.created_at DESC, r.reservation_id DESC
     LIMIT 5`
  );
  return rows.map((row) => ({
    booking_reference: row.booking_reference,
    guest: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Guest',
    resource: row.room_number || row.venue_name || 'N/A',
    status: row.status,
    booking_source: row.booking_source,
  }));
}

async function getDashboard(req, res) {
  const { date, endExclusive } = getTodayRange();
  const monthRange = getMonthRangeEndingToday(6);
  const ninetyDayRange = getNinetyDayRange(date);
  let core;
  try {
    core = await getSnapshot(date, endExclusive);
  } catch (error) {
    console.error('[getDashboard] Core reservation query failed:', error.message);
    return res.status(500).json({ error: 'Failed to load dashboard data.' });
  }

  const sections = {};
  const sectionErrors = [];
  const runSection = async (name, task) => {
    try {
      sections[name] = await task();
    } catch (error) {
      console.error(`[getDashboard] ${name} section failed:`, error.message);
      sections[name] = null;
      sectionErrors.push(name);
    }
  };

  await Promise.all([
    runSection('revenue', () => getRevenue(date, monthRange.startDate, endExclusive)),
    runSection('action_items', () => getActionItems(date)),
    runSection('booking_trend', () => getBookingTrend(monthRange.startDate, endExclusive, monthRange.months)),
    runSection('popular', () => getPopular(ninetyDayRange.startDate, ninetyDayRange.endExclusive)),
    runSection('recent_reservations', getRecentReservations),
  ]);

  const snapshot = core.snapshot;
  return res.status(200).json({
    generated_at: new Date().toISOString(),
    today: {
      date,
      arrivals: toNumber(snapshot.arrivals),
      departures: toNumber(snapshot.departures),
      checked_in_guests: toNumber(snapshot.checked_in_guests),
      venue_events: toNumber(snapshot.venue_events),
    },
    action_items: sections.action_items || null,
    occupancy: core.occupancy,
    revenue: sections.revenue || null,
    booking_trend: sections.booking_trend || null,
    popular: sections.popular || null,
    recent_reservations: sections.recent_reservations || null,
    section_errors: sectionErrors,
  });
}

module.exports = { getDashboard };