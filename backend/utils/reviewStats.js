const pool = require('../config/db');

const REVIEW_STATS_SELECT = `
  ROUND(review_stats.average_rating, 1) AS average_rating,
  COALESCE(review_stats.review_count, 0) AS review_count
`;

function reviewStatsJoin(resourceColumn) {
  return `
    LEFT JOIN (
      SELECT reservations.${resourceColumn} AS resource_id,
             AVG(reviews.rating) AS average_rating,
             COUNT(*) AS review_count
      FROM Reviews reviews
      INNER JOIN Reservations reservations ON reservations.reservation_id = reviews.reservation_id
      WHERE reservations.status = 'completed'
        AND reservations.${resourceColumn} IS NOT NULL
      GROUP BY reservations.${resourceColumn}
    ) review_stats ON review_stats.resource_id = ${resourceColumn === 'room_id' ? 'r.room_id' : 'v.venue_id'}
  `;
}

function isMissingReviewsTable(error) {
  return ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_TABLEACCESS_DENIED_ERROR'].includes(error?.code)
    || [1051, 1054, 1146].includes(error?.errno);
}

async function queryWithReviewStats(query, fallbackQuery, params = []) {
  try {
    const [rows] = await pool.query(query, params);
    return rows.map((row) => ({
      ...row,
      average_rating: row.average_rating == null ? null : Number(row.average_rating),
      review_count: Number(row.review_count ?? 0),
    }));
  } catch (error) {
    if (!isMissingReviewsTable(error)) throw error;
    const [rows] = await pool.query(fallbackQuery, params);
    return rows.map((row) => ({ ...row, average_rating: null, review_count: 0 }));
  }
}

module.exports = { REVIEW_STATS_SELECT, reviewStatsJoin, queryWithReviewStats };
