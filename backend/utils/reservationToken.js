const { getJwtSecret } = require('./jwtSecret');
const { signJwt, verifyJwt } = require('./sessionJwt');

const RESERVATION_ACCESS_SECRET = getJwtSecret() + ':reservation_access';

function signReservationToken(reservationId) {
  return signJwt(
    { reservation_id: reservationId, purpose: 'reservation_access' },
    RESERVATION_ACCESS_SECRET,
    '24h'
  );
}

function verifyReservationToken(token) {
  if (!token) return null;

  try {
    const payload = verifyJwt(token, RESERVATION_ACCESS_SECRET);
    if (payload.purpose !== 'reservation_access') return null;
    return payload;
  } catch (err) {
    return null;
  }
}

module.exports = { signReservationToken, verifyReservationToken };
