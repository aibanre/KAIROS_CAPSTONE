const pool = require('../config/db');
const {
  calculateBalance,
  calculateDeposit,
  fromCents,
  toCents,
} = require('../config/paymentPolicy');

async function hasColumn(executor, tableName, columnName) {
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function hasTable(executor, tableName) {
  const [rows] = await executor.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function getPaymentSummary(executor = pool, reservationId, reservation = null) {
  let currentReservation = reservation;
  if (!currentReservation) {
    const [rows] = await executor.query(
      `SELECT reservation_id, total_amount, booking_source, status,
              early_checkin_fee, late_checkout_fee, fees_collected_at
       FROM Reservations WHERE reservation_id = ? LIMIT 1`,
      [reservationId]
    );
    currentReservation = rows[0];
  }
  if (!currentReservation) return null;

  const paymentTypeAvailable = await hasColumn(executor, 'Payments', 'payment_type');
  const addonsAvailable = await hasTable(executor, 'Reservation_Addons');
  const paymentTypeSelect = paymentTypeAvailable ? ', p.payment_type' : '';
  const [payments] = await executor.query(
    `SELECT p.amount, p.payment_status${paymentTypeSelect}
     FROM Payments p WHERE p.reservation_id = ?`,
    [currentReservation.reservation_id]
  );
  let addonsTotalCents = 0;
  let bedsAdded = 0;
  if (addonsAvailable) {
    const [addons] = await executor.query(
      `SELECT COALESCE(SUM(quantity * unit_price), 0) AS addons_total,
              COALESCE(SUM(CASE WHEN addon_type = 'extra_bed' THEN quantity ELSE 0 END), 0) AS beds_added
       FROM Reservation_Addons WHERE reservation_id = ?`,
      [currentReservation.reservation_id]
    );
    addonsTotalCents = toCents(addons[0]?.addons_total);
    bedsAdded = Number(addons[0]?.beds_added || 0);
  }

  const amountPaidCents = payments
    .filter((payment) => payment.payment_status === 'verified')
    .reduce((sum, payment) => sum + toCents(payment.amount), 0);
  const baseTotalCents = toCents(currentReservation.total_amount);
  const attendanceFeesCents = toCents(currentReservation.early_checkin_fee)
    + toCents(currentReservation.late_checkout_fee);
  const legacyFeesCollected = Boolean(currentReservation.fees_collected_at)
    && attendanceFeesCents > 0
    && amountPaidCents <= baseTotalCents + addonsTotalCents;
  const earlyFeeCents = legacyFeesCollected ? 0 : toCents(currentReservation.early_checkin_fee);
  const lateFeeCents = legacyFeesCollected ? 0 : toCents(currentReservation.late_checkout_fee);
  let inventoryChargesCents = 0;
  let legacyInventoryCollected = false;
  if (await hasTable(executor, 'Reservation_Inventory_Checks')) {
    try {
      const [checks] = await executor.query(
        `SELECT total_charge_cents, charges_collected_at
         FROM Reservation_Inventory_Checks WHERE reservation_id = ? LIMIT 1`,
        [currentReservation.reservation_id]
      );
      inventoryChargesCents = Number(checks[0]?.total_charge_cents || 0);
      legacyInventoryCollected = Boolean(checks[0]?.charges_collected_at)
        && amountPaidCents <= baseTotalCents + addonsTotalCents + attendanceFeesCents;
    } catch (error) {
      if (![1146, 1054].includes(error?.errno)) throw error;
    }
  }
  const billedInventoryCents = legacyInventoryCollected ? 0 : inventoryChargesCents;
  const totalCents = baseTotalCents + addonsTotalCents + earlyFeeCents + lateFeeCents + billedInventoryCents;
  const depositDueCents = calculateDeposit(currentReservation.total_amount);
  const balanceDueCents = Math.max(0, totalCents - Math.max(amountPaidCents, depositDueCents));

  return {
    base_total: fromCents(baseTotalCents),
    addons_total: fromCents(addonsTotalCents),
    early_fee: fromCents(earlyFeeCents),
    late_fee: fromCents(lateFeeCents),
    inventory_charges_total: fromCents(billedInventoryCents),
    total: fromCents(totalCents),
    amount_paid: fromCents(amountPaidCents),
    deposit_due: fromCents(depositDueCents),
    balance_due: fromCents(balanceDueCents),
    payment_summary: amountPaidCents <= 0 ? 'unpaid' : balanceDueCents <= 0 ? 'fully_paid' : 'deposit_paid',
    beds_added: bedsAdded,
    payment_type_available: paymentTypeAvailable,
    addons_available: addonsAvailable,
  };
}

async function getSchemaAvailability(executor = pool) {
  const [paymentTypeAvailable, addonsAvailable, maxBedsAvailable] = await Promise.all([
    hasColumn(executor, 'Payments', 'payment_type'),
    hasTable(executor, 'Reservation_Addons'),
    hasColumn(executor, 'Rooms', 'max_extra_beds'),
  ]);
  return { paymentTypeAvailable, addonsAvailable, maxBedsAvailable };
}

module.exports = { getPaymentSummary, getSchemaAvailability, hasColumn, hasTable };
