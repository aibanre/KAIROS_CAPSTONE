const pool = require('../config/db');

async function listVenues(req, res) {
  try {
    const [venues] = await pool.query(
      `SELECT * FROM Venues WHERE status = 'available' ORDER BY venue_name ASC`
    );

    return res.status(200).json({ venues });
  } catch (err) {
    console.error('[listVenues] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch venues.' });
  }
}

async function getVenue(req, res) {
  try {
    const [venues] = await pool.query(
      `SELECT * FROM Venues WHERE venue_id = ? AND status = 'available'`,
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
    const [rows] = await pool.query(
      `SELECT event_date FROM Reservations WHERE venue_id=? AND status IN ('payment_pending','pending_verification','confirmed','checked_in')
       AND YEAR(event_date)=? AND MONTH(event_date)=? ORDER BY event_date`, [req.params.id, year, month]
    );
    return res.json({ booked_dates: rows.map((row) => row.event_date) });
  } catch (err) { return res.status(500).json({ error: 'Failed to fetch venue availability.' }); }
}

module.exports = { listVenues, getVenue, getBookedDates };