const pool = require('../config/db');
const { uploadImageToCloudinary, deleteImageFromCloudinary } = require('../utils/cloudinaryUpload');
const logAudit = require('../utils/logAudit');

const isSchemaUnavailable = (error) => [1146, 1054].includes(error?.errno)
  || ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error?.code);
const unavailable = (res) => res.status(503).json({ error: 'The inventory migration has not been applied.' });
const nonNegativeInteger = (value) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;

function parseJson(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function booleanValue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function parseLines(body) {
  const lines = parseJson(body.lines || body.items, []);
  return Array.isArray(lines) ? lines : null;
}

async function listInventoryItems(req, res) {
  try {
    const includeInactive = req.query.include_inactive === '1' && req.user.role === 'admin';
    const [items] = await pool.query(
      `SELECT item_id, item_name, default_charge_cents, is_active
       FROM Inventory_Items ${includeInactive ? '' : 'WHERE is_active = TRUE'} ORDER BY item_id`
    );
    return res.json({ items });
  } catch (error) {
    console.error('[inventory:list-items]', error.message);
    return isSchemaUnavailable(error) ? unavailable(res) : res.status(500).json({ error: 'Failed to fetch inventory items.' });
  }
}

function parseItemInput(body) {
    const name = String(body.item_name ?? body.name ?? '').trim();
    const charge = nonNegativeInteger(body.default_charge_cents);
    if (!name) return { error: 'Item name is required.' };
    if (name.length > 150) return { error: 'Item name must be 150 characters or fewer.' };
    if (charge === null) return { error: 'Default charge must be a non-negative integer amount in centavos.' };
    return { name, charge };
  }

async function createInventoryItem(req, res) {
    const input = parseItemInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    try {
      const [[duplicate]] = await pool.query('SELECT item_id FROM Inventory_Items WHERE LOWER(item_name) = LOWER(?) LIMIT 1', [input.name]);
      if (duplicate) return res.status(409).json({ error: 'An inventory item with that name already exists.' });
      const [result] = await pool.query(
        'INSERT INTO Inventory_Items (item_name, default_charge_cents, is_active) VALUES (?, ?, TRUE)',
        [input.name, input.charge]
      );
      const [[item]] = await pool.query(
        'SELECT item_id, item_name, default_charge_cents, is_active FROM Inventory_Items WHERE item_id = ?',
        [result.insertId]
      );
      return res.status(201).json({ item });
    } catch (error) {
      console.error('[inventory:create-item]', error.message);
      return isSchemaUnavailable(error) ? unavailable(res) : res.status(500).json({ error: 'Failed to create inventory item.' });
    }
  }

async function updateInventoryItem(req, res) {
    const itemId = nonNegativeInteger(req.params.id);
    const input = parseItemInput(req.body);
    if (!itemId) return res.status(400).json({ error: 'Invalid inventory item ID.' });
    if (input.error) return res.status(400).json({ error: input.error });
    try {
      const [[duplicate]] = await pool.query(
        'SELECT item_id FROM Inventory_Items WHERE LOWER(item_name) = LOWER(?) AND item_id <> ? LIMIT 1',
        [input.name, itemId]
      );
      if (duplicate) return res.status(409).json({ error: 'An inventory item with that name already exists.' });
      const [result] = await pool.query(
        'UPDATE Inventory_Items SET item_name = ?, default_charge_cents = ? WHERE item_id = ?',
        [input.name, input.charge, itemId]
      );
      if (!result.affectedRows) return res.status(404).json({ error: 'Inventory item not found.' });
      const [[item]] = await pool.query(
        'SELECT item_id, item_name, default_charge_cents, is_active FROM Inventory_Items WHERE item_id = ?',
        [itemId]
      );
      return res.json({ item });
    } catch (error) {
      console.error('[inventory:update-item]', error.message);
      return isSchemaUnavailable(error) ? unavailable(res) : res.status(500).json({ error: 'Failed to update inventory item.' });
    }
  }

async function setInventoryItemActive(req, res) {
    const itemId = nonNegativeInteger(req.params.id);
    const isActive = req.params.action === 'reactivate';
    if (!itemId || !['deactivate', 'reactivate'].includes(req.params.action)) {
      return res.status(400).json({ error: 'Invalid inventory item action.' });
    }
    try {
      const [result] = await pool.query('UPDATE Inventory_Items SET is_active = ? WHERE item_id = ?', [isActive, itemId]);
      if (!result.affectedRows) return res.status(404).json({ error: 'Inventory item not found.' });
      const [[item]] = await pool.query(
        'SELECT item_id, item_name, default_charge_cents, is_active FROM Inventory_Items WHERE item_id = ?',
        [itemId]
      );
      return res.json({ item, message: `Inventory item ${isActive ? 'reactivated' : 'deactivated'} successfully.` });
    } catch (error) {
      console.error('[inventory:set-item-active]', error.message);
      return isSchemaUnavailable(error) ? unavailable(res) : res.status(500).json({ error: 'Failed to update inventory item status.' });
  }
}

async function getInventory(req, res) {
  const reservationId = nonNegativeInteger(req.params.id);
  if (!reservationId) return res.status(400).json({ error: 'Invalid reservation ID.' });
  try {
    const [[check]] = await pool.query(
      `SELECT check_id, reservation_id, performed_by, guest_name, attendant_name,
              signature_url, signed_at, no_damage_inside, no_cr_clogging, notes,
              total_charge_cents, charges_collected_at, charges_collected_by, created_at
       FROM Reservation_Inventory_Checks WHERE reservation_id = ?`,
      [reservationId]
    );
    if (!check) return res.json({ inspection: null });
    const [lines] = await pool.query(
      `SELECT line_id, check_id, item_id, item_name, quantity, quantity_missing,
              unit_charge_cents, charge_cents
       FROM Reservation_Inventory_Lines WHERE check_id = ? ORDER BY line_id`,
      [check.check_id]
    );
    return res.json({ inspection: { ...check, lines } });
  } catch (error) {
    console.error('[inventory:get]', error.message);
    return isSchemaUnavailable(error) ? unavailable(res) : res.status(500).json({ error: 'Failed to fetch room inspection.' });
  }
}

async function saveInventory(req, res) {
  const reservationId = nonNegativeInteger(req.params.id);
  const lines = parseLines(req.body);
  const guestName = String(req.body.guest_name || '').trim();
  const attendantName = String(req.body.attendant_name || '').trim();
  if (!reservationId || !lines || !guestName || !attendantName || !req.file) {
    return res.status(400).json({ error: 'Guest name, attendant name, signature, and inspection lines are required.' });
  }

  const connection = await pool.getConnection();
  let signatureUrl = null;
  try {
    await connection.beginTransaction();
    const [[reservation]] = await connection.query(
      `SELECT reservation_id, room_id, status FROM Reservations
       WHERE reservation_id = ? FOR UPDATE`,
      [reservationId]
    );
    if (!reservation || !reservation.room_id || reservation.status !== 'checked_in') {
      await connection.rollback();
      return res.status(409).json({ error: 'Only checked-in room reservations can be inspected at check-out.' });
    }
    const [[existing]] = await connection.query(
      'SELECT check_id FROM Reservation_Inventory_Checks WHERE reservation_id = ? FOR UPDATE',
      [reservationId]
    );
    if (existing) {
      await connection.rollback();
      return res.status(409).json({ error: 'A room inspection already exists for this reservation.' });
    }

    signatureUrl = await uploadImageToCloudinary(req.file.buffer, 'kairos/signatures');
    const normalizedLines = [];
    let totalChargeCents = 0;
    for (const input of lines) {
      const itemId = nonNegativeInteger(input.item_id);
      const quantity = nonNegativeInteger(input.quantity);
      const quantityMissing = nonNegativeInteger(input.quantity_missing);
      if (!itemId || quantity === null || quantityMissing === null || quantityMissing > quantity) {
        throw Object.assign(new Error('Invalid inspection quantities.'), { status: 400 });
      }
      const [[item]] = await connection.query(
        `SELECT item_id, item_name, default_charge_cents
         FROM Inventory_Items WHERE item_id = ? AND is_active = TRUE FOR UPDATE`,
        [itemId]
      );
      if (!item) throw Object.assign(new Error('Invalid inspection item.'), { status: 400 });
      const chargeCents = quantityMissing * Number(item.default_charge_cents);
      if (!Number.isSafeInteger(chargeCents)) throw Object.assign(new Error('Invalid inspection charge.'), { status: 400 });
      totalChargeCents += chargeCents;
      normalizedLines.push([item.item_id, item.item_name, quantity, quantityMissing, item.default_charge_cents, chargeCents]);
    }

    const [checkResult] = await connection.query(
      `INSERT INTO Reservation_Inventory_Checks
       (reservation_id, performed_by, guest_name, attendant_name, signature_url, signed_at,
        no_damage_inside, no_cr_clogging, notes, total_charge_cents)
       VALUES (?, ?, ?, ?, ?, CONVERT_TZ(NOW(), '+00:00', '+08:00'), ?, ?, ?, ?)`,
      [reservationId, req.user.user_id, guestName, attendantName, signatureUrl,
        booleanValue(req.body.no_damage_inside), booleanValue(req.body.no_cr_clogging),
        String(req.body.notes || '').trim() || null, totalChargeCents]
    );
    for (const line of normalizedLines) {
      await connection.query(
        `INSERT INTO Reservation_Inventory_Lines
         (check_id, item_id, item_name, quantity, quantity_missing, unit_charge_cents, charge_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [checkResult.insertId, ...line]
      );
    }
    await logAudit({
      connection,
      userId: req.user.user_id,
      action: 'inventory_checkout',
      entityType: 'reservation',
      entityId: reservationId,
      newValue: { total_charge_cents: totalChargeCents, no_damage_inside: booleanValue(req.body.no_damage_inside), no_cr_clogging: booleanValue(req.body.no_cr_clogging) },
      ipAddress: req.ip,
    });
    await connection.commit();
    return res.status(201).json({ inspection_id: checkResult.insertId, total_charge_cents: totalChargeCents });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    if (signatureUrl) {
      try { await deleteImageFromCloudinary(signatureUrl); } catch (cleanupError) { console.error('[inventory:signature-cleanup]', cleanupError.message); }
    }
    console.error('[inventory:save]', error.message);
    if (isSchemaUnavailable(error)) return unavailable(res);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to save room inspection.' });
  } finally {
    connection.release();
  }
}

async function collectCharges(req, res) {
  const reservationId = nonNegativeInteger(req.params.id);
  if (!reservationId) return res.status(400).json({ error: 'Invalid reservation ID.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[check]] = await connection.query(
      `SELECT check_id, total_charge_cents, charges_collected_at
       FROM Reservation_Inventory_Checks WHERE reservation_id = ? FOR UPDATE`,
      [reservationId]
    );
    if (!check) {
      await connection.rollback();
      return res.status(409).json({ error: 'A completed room inspection is required before collecting charges.' });
    }
    if (Number(check.total_charge_cents) > 0 && !check.charges_collected_at) {
      await connection.query(
        `UPDATE Reservation_Inventory_Checks
         SET charges_collected_at = CONVERT_TZ(NOW(), '+00:00', '+08:00'), charges_collected_by = ?
         WHERE check_id = ?`,
        [req.user.user_id, check.check_id]
      );
    }
    await logAudit({
      connection,
      userId: req.user.user_id,
      action: 'inventory_charges_collected',
      entityType: 'reservation',
      entityId: reservationId,
      newValue: { total_charge_cents: Number(check.total_charge_cents) },
      ipAddress: req.ip,
    });
    await connection.commit();
    return res.json({ collected: true, total_charge_cents: Number(check.total_charge_cents) });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.error('[inventory:collect]', error.message);
    return isSchemaUnavailable(error) ? unavailable(res) : res.status(500).json({ error: 'Failed to collect room charges.' });
  } finally {
    connection.release();
  }
}

module.exports = {
  listInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  setInventoryItemActive,
  getInventory,
  saveInventory,
  collectCharges,
};
