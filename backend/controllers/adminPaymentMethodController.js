// controllers/adminPaymentMethodController.js
const pool = require('../config/db');
const { uploadImageToCloudinary } = require('../utils/cloudinaryUpload');

async function getAllPaymentMethods(req, res) {
  try {
    const [paymentMethods] = await pool.query(
      `SELECT payment_method_id, method_name, method_type, qr_image_url,
              account_name, account_number, is_active, created_at
       FROM PaymentMethods
       ORDER BY created_at DESC`
    );

    return res.status(200).json({ count: paymentMethods.length, paymentMethods });
  } catch (err) {
    console.error('[getAllPaymentMethods] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch payment methods.' });
  }
}

async function createPaymentMethod(req, res) {
  const { method_name, method_type, account_name, account_number } = req.body;

  if (!method_name?.trim() || !method_type?.trim()) {
    return res.status(400).json({ error: 'method_name and method_type are required.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'qr_image is required.' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT payment_method_id FROM PaymentMethods WHERE method_name = ?',
      [method_name.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: `Payment method "${method_name.trim()}" already exists.` });
    }

    const qrImageUrl = await uploadImageToCloudinary(req.file.buffer, 'kairos/payment-methods');
    const [result] = await pool.query(
      `INSERT INTO PaymentMethods (method_name, method_type, qr_image_url, account_name, account_number)
       VALUES (?, ?, ?, ?, ?)`,
      [method_name.trim(), method_type.trim(), qrImageUrl, account_name?.trim() || null, account_number?.trim() || null]
    );

    const [paymentMethods] = await pool.query(
      'SELECT * FROM PaymentMethods WHERE payment_method_id = ?',
      [result.insertId]
    );

    return res.status(201).json({ message: 'Payment method created successfully.', paymentMethod: paymentMethods[0] });
  } catch (err) {
    console.error('[createPaymentMethod] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create payment method.' });
  }
}

async function updatePaymentMethod(req, res) {
  const { id } = req.params;
  const { method_name, method_type, account_name, account_number } = req.body;

  try {
    const [existing] = await pool.query('SELECT * FROM PaymentMethods WHERE payment_method_id = ?', [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Payment method not found.' });
    }

    const current = existing[0];
    if (method_name !== undefined && !method_name.trim()) {
      return res.status(400).json({ error: 'method_name cannot be empty.' });
    }
    if (method_type !== undefined && !method_type.trim()) {
      return res.status(400).json({ error: 'method_type cannot be empty.' });
    }

    if (method_name !== undefined && method_name.trim() !== current.method_name) {
      const [duplicate] = await pool.query(
        'SELECT payment_method_id FROM PaymentMethods WHERE method_name = ? AND payment_method_id != ?',
        [method_name.trim(), id]
      );
      if (duplicate.length > 0) {
        return res.status(409).json({ error: `Payment method "${method_name.trim()}" already exists.` });
      }
    }

    const qrImageUrl = req.file
      ? await uploadImageToCloudinary(req.file.buffer, 'kairos/payment-methods')
      : current.qr_image_url;

    await pool.query(
      `UPDATE PaymentMethods SET
        method_name = ?,
        method_type = ?,
        qr_image_url = ?,
        account_name = ?,
        account_number = ?
       WHERE payment_method_id = ?`,
      [
        method_name?.trim() ?? current.method_name,
        method_type?.trim() ?? current.method_type,
        qrImageUrl,
        account_name?.trim() ?? current.account_name,
        account_number?.trim() ?? current.account_number,
        id,
      ]
    );

    const [updated] = await pool.query('SELECT * FROM PaymentMethods WHERE payment_method_id = ?', [id]);
    return res.status(200).json({ message: 'Payment method updated successfully.', paymentMethod: updated[0] });
  } catch (err) {
    console.error('[updatePaymentMethod] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update payment method.' });
  }
}

async function setPaymentMethodActiveState(req, res, isActive) {
  const { id } = req.params;

  try {
    const [existing] = await pool.query('SELECT payment_method_id FROM PaymentMethods WHERE payment_method_id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Payment method not found.' });

    await pool.query('UPDATE PaymentMethods SET is_active = ? WHERE payment_method_id = ?', [isActive, id]);
    return res.status(200).json({ message: `Payment method ${isActive ? 'reactivated' : 'deactivated'} successfully.` });
  } catch (err) {
    const action = isActive ? 'reactivate' : 'deactivate';
    console.error(`[${action}PaymentMethod] Error:`, err.message);
    return res.status(500).json({ error: `Failed to ${action} payment method.` });
  }
}

function deactivatePaymentMethod(req, res) {
  return setPaymentMethodActiveState(req, res, false);
}

function reactivatePaymentMethod(req, res) {
  return setPaymentMethodActiveState(req, res, true);
}

module.exports = {
  getAllPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deactivatePaymentMethod,
  reactivatePaymentMethod,
};