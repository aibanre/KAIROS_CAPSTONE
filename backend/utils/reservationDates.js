const { MIN_BOOKING_LEAD_DAYS } = require('../config/reservationConfig');

const MANILA_TIME_ZONE = 'Asia/Manila';

function getManilaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getManilaToday(date = new Date()) {
  const parts = getManilaDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getEarliestBookableDate(date = new Date()) {
  return addDays(getManilaToday(date), MIN_BOOKING_LEAD_DAYS);
}

function isBeforeEarliestBookableDate(value, date = new Date()) {
  return typeof value === 'string' && value < getEarliestBookableDate(date);
}

function earliestBookingMessage(date = new Date()) {
  return `Reservations must be made at least one day in advance. The earliest available date is ${getEarliestBookableDate(date)}.`;
}

module.exports = {
  MANILA_TIME_ZONE,
  getManilaToday,
  getEarliestBookableDate,
  isBeforeEarliestBookableDate,
  earliestBookingMessage,
};
