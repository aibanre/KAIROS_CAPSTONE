// controllers/adminCustomerController.js
const pool = require('../config/db');

const customerColumns = `
  customer_id,
  first_name,
  last_name,
  email,
  phone_number,
  address,
  is_registered,
  is_active,
  created_at`;

async function getAllCustomers(req, res) {
  const { type } = req.query;
  const conditions = [];
  const values = [];

  if (type === 'registered' || type === 'guest') {
    conditions.push('c.is_registered = ?');
    values.push(type === 'registered');
  } else if (type !== undefined) {
    return res.status(400).json({ error: 'type must be registered or guest.' });
  }

  try {
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [customers] = await pool.query(
      `SELECT ${customerColumns},
              (SELECT COUNT(*) FROM Reservations r WHERE r.customer_id = c.customer_id) AS reservation_count
       FROM Customer c
       ${whereClause}
       ORDER BY c.created_at DESC`,
      values
    );

    return res.status(200).json({ count: customers.length, customers });
  } catch (err) {
    console.error('[getAllCustomers] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch customers.' });
  }
}

async function getCustomerById(req, res) {
  const { id } = req.params;

  try {
    const [customers] = await pool.query(
      `SELECT ${customerColumns} FROM Customer WHERE customer_id = ?`,
      [id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const [reservations] = await pool.query(
      `SELECT * FROM Reservations WHERE customer_id = ? ORDER BY created_at DESC`,
      [id]
    );

    return res.status(200).json({ customer: customers[0], reservations });
  } catch (err) {
    console.error('[getCustomerById] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch customer.' });
  }
}

async function setCustomerActiveState(req, res, isActive) {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(
      'SELECT customer_id, is_registered FROM Customer WHERE customer_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    if (!existing[0].is_registered) {
      return res.status(400).json({ error: 'Guest customers do not have accounts to manage.' });
    }

    await pool.query(
      'UPDATE Customer SET is_active = ? WHERE customer_id = ?',
      [isActive, id]
    );

    return res.status(200).json({
      message: `Customer ${isActive ? 'reactivated' : 'deactivated'} successfully.`,
    });
  } catch (err) {
    const action = isActive ? 'reactivate' : 'deactivate';
    console.error(`[${action}Customer] Error:`, err.message);
    return res.status(500).json({ error: `Failed to ${action} customer.` });
  }
}

function deactivateCustomer(req, res) {
  return setCustomerActiveState(req, res, false);
}

function reactivateCustomer(req, res) {
  return setCustomerActiveState(req, res, true);
}

module.exports = {
  getAllCustomers,
  getCustomerById,
  deactivateCustomer,
  reactivateCustomer,
};