const activeHoldsByIp = new Map();
const reservationIps = new Map();
const ipQueues = new Map();

async function withIpHoldLock(ipAddress, callback) {
  const ip = String(ipAddress || 'unknown');
  const previous = ipQueues.get(ip) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  ipQueues.set(ip, current);
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (ipQueues.get(ip) === current) ipQueues.delete(ip);
  }
}

function getActiveIpHoldCount(ipAddress, excludedReservationIds = []) {
  const ip = String(ipAddress || 'unknown');
  const holds = activeHoldsByIp.get(ip);
  if (!holds) return 0;
  const now = Date.now();
  const excluded = new Set(excludedReservationIds.map(Number));
  for (const [reservationId, expiresAt] of holds) {
    if (expiresAt <= now) {
      holds.delete(reservationId);
      reservationIps.delete(reservationId);
    }
  }
  if (holds.size === 0) activeHoldsByIp.delete(ip);
  return [...holds.keys()].filter((reservationId) => !excluded.has(Number(reservationId))).length;
}

function recordActiveIpHold(ipAddress, reservationId, holdExpiresAt) {
  const ip = String(ipAddress || 'unknown');
  const id = Number(reservationId);
  removeActiveIpHold(id);
  const holds = activeHoldsByIp.get(ip) || new Map();
  holds.set(id, new Date(holdExpiresAt).getTime());
  activeHoldsByIp.set(ip, holds);
  reservationIps.set(id, ip);
}

function removeActiveIpHold(reservationId) {
  const id = Number(reservationId);
  const ip = reservationIps.get(id);
  if (!ip) return;
  const holds = activeHoldsByIp.get(ip);
  holds?.delete(id);
  if (holds?.size === 0) activeHoldsByIp.delete(ip);
  reservationIps.delete(id);
}

function resetActiveIpHolds() {
  activeHoldsByIp.clear();
  reservationIps.clear();
  ipQueues.clear();
}

module.exports = {
  getActiveIpHoldCount,
  recordActiveIpHold,
  removeActiveIpHold,
  resetActiveIpHolds,
  withIpHoldLock,
};
