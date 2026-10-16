const pool = require('../config/db');
const { PLACEHOLDER_CUSTOMER_MARKER } = require('../config/reservationConfig');
const {
  ACTIVE_RESERVATION_STATUSES,
  MANILA_OFFSET,
  buildMonths,
  buildRoomOccupancyQuery,
  getReportDateRange,
  getTableColumns,
  percent,
} = require('../utils/reportMetrics');
const { getPaymentSummary, getSchemaAvailability } = require('../utils/paymentSummary');

function toNumber(value) {
  return Number(value || 0);
}

async function getReports(req, res) {
  const range = getReportDateRange(req.query);
  if (range.error) return res.status(400).json({ error: range.error });

  const { startDate, endDate, endExclusive, days, start, end } = range;
  const months = buildMonths(start, end);
  const monthKeys = new Set(months.map(({ key }) => key));
  const paymentColumns = await getTableColumns('Payments', ['verified_at']).catch((error) => {
      console.error('[getReports] Payment date column check failed:', error.message);
      return new Set();
    });
  const revenueDateField = paymentColumns.has('verified_at') ? 'p.verified_at' : 'p.created_at';

  try {
    const { paymentTypeAvailable } = await getSchemaAvailability(pool);
    // Inventory is a manual migration; reports remain usable before it exists.
    let inventoryChargeRows = [{ amount_cents: 0, charges: 0 }];
    let inventoryAvailable = false;
    try {
      [inventoryChargeRows] = await pool.query(
        `SELECT COALESCE(SUM(total_charge_cents), 0) AS amount_cents,
                COUNT(*) AS charges
         FROM Reservation_Inventory_Checks
         WHERE signed_at >= CONVERT_TZ(?, ?, '+00:00')
           AND signed_at < CONVERT_TZ(?, ?, '+00:00')`,
        [`${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET]
      );
      inventoryAvailable = true;
    } catch (error) {
      if ((error.code !== 'ER_NO_SUCH_TABLE' && error.errno !== 1146)
        && (error.code !== 'ER_BAD_FIELD_ERROR' && error.errno !== 1054)) throw error;
    }
    const [revenueRows] = await pool.query(
      `SELECT DATE_FORMAT(CONVERT_TZ(${revenueDateField}, '+00:00', ?), '%Y-%m') AS month_key,
              pm.method_name, ${paymentTypeAvailable ? 'p.payment_type' : "'full' AS payment_type"},
              SUM(p.amount) AS amount
       FROM Payments p
       INNER JOIN PaymentMethods pm ON pm.payment_method_id = p.payment_method_id
       WHERE p.payment_status = 'verified'
         AND ${revenueDateField} >= CONVERT_TZ(?, ?, '+00:00')
         AND ${revenueDateField} < CONVERT_TZ(?, ?, '+00:00')
       GROUP BY month_key, pm.method_name, ${paymentTypeAvailable ? 'p.payment_type' : "'full'"}
       ORDER BY month_key, pm.method_name`,
      [MANILA_OFFSET, `${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET]
    );

    const [reservationRows] = await pool.query(
      `SELECT r.status, r.booking_source,
              DATE_FORMAT(CONVERT_TZ(r.created_at, '+00:00', ?), '%Y-%m') AS month_key
       FROM Reservations r
       LEFT JOIN Customer c ON c.customer_id = r.customer_id
       WHERE r.created_at >= CONVERT_TZ(?, ?, '+00:00')
         AND r.created_at < CONVERT_TZ(?, ?, '+00:00')
         AND (c.first_name IS NULL OR c.first_name <> ?)`,
      [MANILA_OFFSET, `${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET, PLACEHOLDER_CUSTOMER_MARKER]
    );

    const occupancyQuery = buildRoomOccupancyQuery({ startDate, endExclusive, statuses: ACTIVE_RESERVATION_STATUSES });
    const [occupancyRows] = await pool.query(occupancyQuery.sql, occupancyQuery.params);

    const [venueOccupancyRows] = await pool.query(
      `SELECT r.venue_id
       FROM Reservations r
       WHERE r.venue_id IS NOT NULL
         AND r.status IN (?, ?, ?)
         AND r.event_date >= ?
         AND r.event_date < ?`,
      [...ACTIVE_RESERVATION_STATUSES, startDate, endExclusive]
    );

    const [activeResources] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM Rooms WHERE status = 'available') AS active_rooms,
         (SELECT COUNT(*) FROM Venues WHERE status = 'available') AS active_venues`
    );

    const [topRows] = await pool.query(
      `SELECT r.room_id, r.venue_id, rm.room_number, v.venue_name, COUNT(*) AS bookings
       FROM Reservations r
       LEFT JOIN Rooms rm ON rm.room_id = r.room_id
       LEFT JOIN Venues v ON v.venue_id = r.venue_id
       WHERE r.status IN (?, ?, ?)
         AND r.created_at >= CONVERT_TZ(?, ?, '+00:00')
         AND r.created_at < CONVERT_TZ(?, ?, '+00:00')
       GROUP BY r.room_id, r.venue_id, rm.room_number, v.venue_name
       ORDER BY bookings DESC
       LIMIT 10`,
      [...ACTIVE_RESERVATION_STATUSES, `${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET]
    );

    const [customerRows] = await pool.query(
      `SELECT c.is_registered, COUNT(DISTINCT r.customer_id) AS customers
       FROM Reservations r
       INNER JOIN Customer c ON c.customer_id = r.customer_id
       WHERE r.created_at >= CONVERT_TZ(?, ?, '+00:00')
         AND r.created_at < CONVERT_TZ(?, ?, '+00:00')
         AND c.first_name <> ?
       GROUP BY c.is_registered`,
      [`${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET, PLACEHOLDER_CUSTOMER_MARKER]
    );

    const [outstandingReservationRows] = await pool.query(`SELECT reservation_id FROM Reservations WHERE status IN ('confirmed', 'checked_in')`);
    const [completedWithBalanceRows] = await pool.query(`SELECT reservation_id FROM Reservations WHERE status = 'completed'`);
    const outstandingSummaries = await Promise.all(outstandingReservationRows.map((row) => getPaymentSummary(pool, row.reservation_id)));
    const completedSummaries = await Promise.all(completedWithBalanceRows.map((row) => getPaymentSummary(pool, row.reservation_id)));
    const [cancelledDepositRows] = await pool.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS amount
       FROM Payments p INNER JOIN Reservations r ON r.reservation_id = p.reservation_id
       WHERE p.payment_status = 'verified' AND r.status = 'cancelled'
         AND ${revenueDateField} >= CONVERT_TZ(?, ?, '+00:00')
         AND ${revenueDateField} < CONVERT_TZ(?, ?, '+00:00')`,
      [`${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET]
    );
    const addonsAvailable = (await getSchemaAvailability(pool)).addonsAvailable;
    const [addonRows] = addonsAvailable
      ? await pool.query(
        `SELECT COALESCE(SUM(quantity * unit_price), 0) AS amount
         FROM Reservation_Addons
         WHERE created_at >= CONVERT_TZ(?, ?, '+00:00')
           AND created_at < CONVERT_TZ(?, ?, '+00:00')`,
        [`${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET]
      )
      : [[{ amount: 0 }]];

    const revenueByMonth = Object.fromEntries(months.map(({ key, label }) => [key, { month: label, revenue: 0 }]));
    const paymentTotals = new Map();
    const paymentTypeTotals = new Map();
    revenueRows.forEach((row) => {
      if (!monthKeys.has(row.month_key)) return;
      revenueByMonth[row.month_key].revenue += toNumber(row.amount);
      paymentTotals.set(row.method_name, (paymentTotals.get(row.method_name) || 0) + toNumber(row.amount));
      paymentTypeTotals.set(row.payment_type, (paymentTypeTotals.get(row.payment_type) || 0) + toNumber(row.amount));
    });

    const bookingByMonth = Object.fromEntries(months.map(({ key, label }) => [key, { month: label, bookings: 0 }]));
    const statusCounts = {};
    const sourceCounts = {};
    reservationRows.forEach((row) => {
      if (bookingByMonth[row.month_key] && ACTIVE_RESERVATION_STATUSES.includes(row.status)) bookingByMonth[row.month_key].bookings += 1;
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      sourceCounts[row.booking_source] = (sourceCounts[row.booking_source] || 0) + 1;
    });

    const totalRevenue = revenueRows.reduce((sum, row) => sum + toNumber(row.amount), 0);
    const totalReservations = reservationRows.length;
    const cancelled = statusCounts.cancelled || 0;
    const roomNights = occupancyRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.clipped_nights)), 0);
    const venueDays = venueOccupancyRows.length;
    const activeRoomCount = toNumber(activeResources[0]?.active_rooms);
    const activeVenueCount = toNumber(activeResources[0]?.active_venues);
    const roomReservations = reservationRows.length
      ? await pool.query(
        `SELECT AVG(DATEDIFF(r.check_out_date, r.check_in_date)) AS average_stay_days
         FROM Reservations r
         WHERE r.room_id IS NOT NULL
           AND r.status IN (?, ?, ?)
           AND r.created_at >= CONVERT_TZ(?, ?, '+00:00')
           AND r.created_at < CONVERT_TZ(?, ?, '+00:00')`,
        [...ACTIVE_RESERVATION_STATUSES, `${startDate} 00:00:00`, MANILA_OFFSET, `${endExclusive} 00:00:00`, MANILA_OFFSET]
      )
      : [[{ average_stay_days: 0 }]];
    const averageStayDays = toNumber(roomReservations[0][0]?.average_stay_days);
    const customerTotals = customerRows.reduce((totals, row) => {
      totals[row.is_registered ? 'registered' : 'guest'] = toNumber(row.customers);
      return totals;
    }, { registered: 0, guest: 0 });
    const customerTotal = customerTotals.registered + customerTotals.guest;

    return res.status(200).json({
      period: { start_date: startDate, end_date: endDate, days },
      revenue_date_field: paymentColumns.has('verified_at') ? 'verified_at' : 'created_at',
      summary: {
        total_revenue: totalRevenue,
        outstanding_balances: { amount: outstandingSummaries.reduce((sum, summary) => sum + (summary?.balance_due || 0), 0), reservations: outstandingSummaries.filter((summary) => summary?.balance_due > 0).length },
        completed_with_balance_count: completedSummaries.filter((summary) => summary?.balance_due > 0).length,
        deposits_retained_from_cancelled: toNumber(cancelledDepositRows[0]?.amount),
        inventory_available: inventoryAvailable,
        inventory_charges_cents: Number(inventoryChargeRows[0]?.amount_cents || 0),
        inventory_charge_count: Number(inventoryChargeRows[0]?.charges || 0),
        occupancy_rate: percent(roomNights, activeRoomCount * days),
        venue_utilization: percent(venueDays, activeVenueCount * days),
        cancellation_rate: percent(cancelled, totalReservations),
        average_stay_days: Number(averageStayDays.toFixed(1)),
      },
      revenue: {
        by_month: months.map(({ key }) => revenueByMonth[key]),
        by_payment_method: [...paymentTotals.entries()].map(([method, amount]) => ({ method, amount, percentage: percent(amount, totalRevenue) })),
        by_payment_type: [...paymentTypeTotals.entries()].map(([payment_type, amount]) => ({ payment_type, amount })),
        addons_billed: toNumber(addonRows[0]?.amount),
        deposits_retained_from_cancelled: toNumber(cancelledDepositRows[0]?.amount),
        inventory_charges_cents: Number(inventoryChargeRows[0]?.amount_cents || 0),
      },
      reservations: {
        by_month: months.map(({ key }) => bookingByMonth[key]),
        by_status: Object.entries(statusCounts).map(([status, count]) => ({ status, count, percentage: percent(count, totalReservations) })),
        by_source: Object.entries(sourceCounts).map(([source, count]) => ({ source, count, percentage: percent(count, totalReservations) })),
      },
      occupancy: {
        rooms: { occupied: percent(roomNights, activeRoomCount * days), available: Number((100 - percent(roomNights, activeRoomCount * days)).toFixed(1)) },
        venues: { occupied: percent(venueDays, activeVenueCount * days), available: Number((100 - percent(venueDays, activeVenueCount * days)).toFixed(1)) },
      },
      top_performers: {
        rooms: topRows.filter((row) => row.room_id).slice(0, 5).map((row) => ({ name: row.room_number, bookings: toNumber(row.bookings) })),
        venues: topRows.filter((row) => row.venue_id).slice(0, 5).map((row) => ({ name: row.venue_name, bookings: toNumber(row.bookings) })),
      },
      customers: {
        registered: { count: customerTotals.registered, percentage: percent(customerTotals.registered, customerTotal) },
        guest: { count: customerTotals.guest, percentage: percent(customerTotals.guest, customerTotal) },
      },
    });
  } catch (err) {
    console.error('[getReports] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate reports.' });
  }
}

module.exports = { getReports };