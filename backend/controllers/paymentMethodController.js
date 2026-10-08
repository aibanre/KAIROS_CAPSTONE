const pool = require('../config/db');

async function getActivePaymentMethods(req, res) {
  try {
    const [paymentMethods] = await pool.query(
      `SELECT payment_method_id, method_name, method_type, qr_image_url,
              account_name, account_number
       FROM PaymentMethods
       WHERE is_active = TRUE
         AND method_type NOT IN ('cash', 'card')
       ORDER BY method_name ASC`
    );

    return res.status(200).json({ paymentMethods });
  } catch (err) {
    console.error('[getActivePaymentMethods] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch payment methods.' });
  }
}

module.exports = { getActivePaymentMethods };
