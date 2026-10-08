const DEPOSIT_PERCENTAGE = 50;
const EXTRA_BED_PRICE = 450;
const MAX_EXTRA_BEDS_PER_REQUEST = 10;
const MAX_EXTRA_BEDS_PER_ROOM = 20;
const NO_RECEIPT_METHOD_TYPES = ['cash', 'card'];

function toCents(value) {
  const normalized = String(value ?? 0).trim();
  if (/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    const [whole, fraction = ''] = normalized.split('.');
    return Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2)) * (Number(whole) < 0 ? -1 : 1);
  }
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

function fromCents(cents) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

function calculateDeposit(baseTotal) {
  return Math.round(toCents(baseTotal) * DEPOSIT_PERCENTAGE / 100);
}

function calculateBalance(total, amountPaid) {
  return toCents(total) - toCents(amountPaid);
}

module.exports = {
  DEPOSIT_PERCENTAGE,
  EXTRA_BED_PRICE,
  MAX_EXTRA_BEDS_PER_REQUEST,
  MAX_EXTRA_BEDS_PER_ROOM,
  NO_RECEIPT_METHOD_TYPES,
  toCents,
  fromCents,
  calculateDeposit,
  calculateBalance,
};
