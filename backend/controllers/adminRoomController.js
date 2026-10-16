// controllers/adminRoomController.js
const pool = require('../config/db');
const { uploadImageToCloudinary, deleteImageFromCloudinary } = require('../utils/cloudinaryUpload');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { hasColumn } = require('../utils/paymentSummary');
const { validateExistingImage } = require('../utils/imageReferences');
const { validateBulkUpdateRequest, valuesEqual } = require('../utils/adminBulkUpdate');

const MAX_EXTRA_BEDS_PER_ROOM = 20;
const ROOM_STATUSES = ['available', 'unavailable', 'maintenance'];
const BULK_ROOM_FIELDS = new Set([
  'room_type', 'capacity', 'max_extra_beds', 'price_per_night', 'description',
  'amenities', 'status', 'existing_image_url',
]);
const ROOM_BULK_COLUMN_NAMES = Object.freeze({
  room_type: 'room_type',
  capacity: 'capacity',
  max_extra_beds: 'max_extra_beds',
  price_per_night: 'price_per_night',
  description: 'description',
  amenities: 'amenities',
  status: 'status',
  images: 'images',
});

function validateRoomTemplateFields({ capacity, price_per_night, max_extra_beds, status }) {
  if (capacity !== undefined && (!Number.isFinite(Number(capacity)) || Number(capacity) <= 0)) {
    return 'capacity must be greater than 0.';
  }

  if (price_per_night !== undefined && (!Number.isFinite(Number(price_per_night)) || Number(price_per_night) <= 0)) {
    return 'price_per_night must be greater than 0.';
  }
  if (max_extra_beds !== undefined && (!Number.isInteger(Number(max_extra_beds)) || Number(max_extra_beds) < 0 || Number(max_extra_beds) > MAX_EXTRA_BEDS_PER_ROOM)) {
    return `max_extra_beds must be an integer from 0 to ${MAX_EXTRA_BEDS_PER_ROOM}.`;
  }
  if (status !== undefined && !ROOM_STATUSES.includes(status)) {
    return 'Invalid status value.';
  }

  return null;
}

function parseRoomNumbers(value) {
  if (typeof value !== 'string') return null;
  try {
    const roomNumbers = JSON.parse(value);
    if (!Array.isArray(roomNumbers) || roomNumbers.length < 1 || roomNumbers.length > 50) return null;
    if (!roomNumbers.every((number) => typeof number === 'string' && number.trim() && Array.from(number.trim()).length <= 20)) return null;

    const trimmedNumbers = roomNumbers.map((number) => number.trim());
    const normalizedNumbers = new Set(trimmedNumbers.map((number) => number.toLowerCase()));
    if (normalizedNumbers.size !== trimmedNumbers.length) return null;
    return trimmedNumbers;
  } catch {
    return null;
  }
}

function getRoomNumberConflicts(roomNumbers, existingRoomNumbers) {
  const existing = new Set(existingRoomNumbers.map((number) => number.toLowerCase()));
  return roomNumbers.filter((number) => existing.has(number.toLowerCase()));
}

/**
 * GET /api/admin/rooms
 * Lists ALL rooms regardless of status (available, unavailable, maintenance) —
 * unlike the public-facing endpoint, admins need to see everything to manage it.
 */
async function getAllRooms(req, res) {
  try {
    const [rooms] = await pool.query(`SELECT * FROM Rooms ORDER BY room_number ASC`);
    return res.status(200).json({ count: rooms.length, rooms });
  } catch (err) {
    console.error('[getAllRooms] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
}

/**
 * GET /api/admin/rooms/:id
 */
async function getRoomById(req, res) {
  const { id } = req.params;

  try {
    const [rooms] = await pool.query(`SELECT * FROM Rooms WHERE room_id = ?`, [id]);

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    return res.status(200).json({ room: rooms[0] });
  } catch (err) {
    console.error('[getRoomById] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch room.' });
  }
}

/**
 * POST /api/admin/rooms
 * Creates a new room.
 */
async function createRoom(req, res) {
  const {
    room_number,
    room_type,
    capacity,
    price_per_night,
    description,
    amenities,
    images,
    max_extra_beds,
    existing_image_url,
  } = req.body || {};

  // ---- Validation ----
  if (!room_number || !room_type || !capacity || !price_per_night) {
    return res.status(400).json({
      error: 'room_number, room_type, capacity, and price_per_night are required.',
    });
  }

  const validationError = validateRoomTemplateFields({ capacity, price_per_night, max_extra_beds });
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    // Prevent duplicate room numbers
    const [existing] = await pool.query(
      `SELECT room_id FROM Rooms WHERE room_number = ?`,
      [room_number]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: `Room number "${room_number}" already exists.` });
    }

    const imageUrl = req.file
      ? await uploadImageToCloudinary(req.file.buffer, 'kairos/rooms')
      : existing_image_url
        ? await validateExistingImage(pool, existing_image_url, 'kairos/rooms')
        : null;
    if (existing_image_url && !imageUrl) return res.status(400).json({ error: 'The selected image is not an approved uploaded image.' });

    const supportsExtraBeds = await hasColumn(pool, 'Rooms', 'max_extra_beds');
    const [result] = await pool.query(
      supportsExtraBeds
        ? `INSERT INTO Rooms (room_number, room_type, capacity, max_extra_beds, price_per_night, description, amenities, images, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available')`
        : `INSERT INTO Rooms (room_number, room_type, capacity, price_per_night, description, amenities, images, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'available')`,
      supportsExtraBeds
        ? [room_number, room_type, capacity, Number(max_extra_beds || 0), price_per_night, description || null, amenities || null, imageUrl]
        : [room_number, room_type, capacity, price_per_night, description || null, amenities || null, imageUrl]
    );

    const [newRoom] = await pool.query(`SELECT * FROM Rooms WHERE room_id = ?`, [result.insertId]);
    await logAudit({
      userId: req.user.user_id, action: ACTIONS.ROOM_CREATE, entityType: ENTITY_TYPES.ROOM, entityId: result.insertId,
      newValue: { room_number, room_type, capacity, price_per_night, status: 'available' }, ipAddress: req.ip,
    });

    return res.status(201).json({ message: 'Room created successfully.', room: newRoom[0] });
  } catch (err) {
    console.error('[createRoom] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create room.' });
  }
}

/**
 * POST /api/admin/rooms/bulk
 * Creates multiple rooms from one shared template.
 */
async function bulkCreateRooms(req, res) {
  const body = req.body || {};
  const roomNumbers = parseRoomNumbers(body.room_numbers);
  if (!roomNumbers) {
    return res.status(400).json({ error: 'room_numbers must be a JSON array of 1 to 50 unique room numbers, each 1 to 20 characters.' });
  }
  if (!body.room_type || !body.capacity || !body.price_per_night) {
    return res.status(400).json({ error: 'room_type, capacity, and price_per_night are required.' });
  }

  const status = body.status === undefined ? 'available' : body.status;
  const validationError = validateRoomTemplateFields({
    capacity: body.capacity,
    price_per_night: body.price_per_night,
    max_extra_beds: body.max_extra_beds,
    status,
  });
  if (validationError) return res.status(400).json({ error: validationError });

  let connection;
  let transactionStarted = false;
  let uploadedImageUrl = null;
  let uploadedCloudinaryAsset = false;
  let committed = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const normalizedNumbers = roomNumbers.map((number) => number.toLowerCase());
    const [existingRooms] = await connection.query(
      'SELECT room_number FROM Rooms WHERE LOWER(room_number) IN (?)',
      [normalizedNumbers]
    );
    const conflicts = getRoomNumberConflicts(roomNumbers, existingRooms.map((room) => room.room_number));
    if (conflicts.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: 'One or more room numbers already exist.', conflicts });
    }

    let inventoryRows = [];
    if (body.copy_inventory_from_room_id) {
      if (!/^\d+$/.test(String(body.copy_inventory_from_room_id)) || Number(body.copy_inventory_from_room_id) < 1) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: 'copy_inventory_from_room_id must be a valid room ID.' });
      }
      const [sourceRooms] = await connection.query(
        'SELECT room_id FROM Rooms WHERE room_id = ?',
        [body.copy_inventory_from_room_id]
      );
      if (!sourceRooms.length) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(404).json({ error: 'Inventory source room not found.' });
      }
      [inventoryRows] = await connection.query(
        'SELECT item_id, expected_quantity FROM room_inventory WHERE room_id = ?',
        [body.copy_inventory_from_room_id]
      );
    }

    if (req.file) {
      uploadedImageUrl = await uploadImageToCloudinary(req.file.buffer, 'kairos/rooms');
      uploadedCloudinaryAsset = true;
    } else if (body.existing_image_url) {
      uploadedImageUrl = await validateExistingImage(connection, body.existing_image_url, 'kairos/rooms');
      if (!uploadedImageUrl) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: 'The selected image is not an approved uploaded image.' });
      }
    }

    const supportsExtraBeds = await hasColumn(connection, 'Rooms', 'max_extra_beds');
    const roomColumns = supportsExtraBeds
      ? '(room_number, room_type, capacity, max_extra_beds, price_per_night, description, amenities, images, status)'
      : '(room_number, room_type, capacity, price_per_night, description, amenities, images, status)';
    const roomPlaceholders = supportsExtraBeds ? '(?, ?, ?, ?, ?, ?, ?, ?, ?)' : '(?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [];
    for (const roomNumber of roomNumbers) {
      if (supportsExtraBeds) {
        values.push(roomNumber, body.room_type, body.capacity, Number(body.max_extra_beds || 0), body.price_per_night, body.description || null, body.amenities || null, uploadedImageUrl, status);
      } else {
        values.push(roomNumber, body.room_type, body.capacity, body.price_per_night, body.description || null, body.amenities || null, uploadedImageUrl, status);
      }
    }
    await connection.query(
      `INSERT INTO Rooms ${roomColumns} VALUES ${roomNumbers.map(() => roomPlaceholders).join(', ')}`,
      values
    );

    const [createdRows] = await connection.query(
      'SELECT * FROM Rooms WHERE LOWER(room_number) IN (?)',
      [normalizedNumbers]
    );
    const createdByNumber = new Map(createdRows.map((room) => [room.room_number.toLowerCase(), room]));
    const created = roomNumbers.map((number) => createdByNumber.get(number.toLowerCase()));
    if (created.some((room) => !room)) throw new Error('Created rooms could not be reloaded.');

    if (inventoryRows.length) {
      const inventoryValues = [];
      for (const room of created) {
        for (const inventory of inventoryRows) {
          inventoryValues.push(room.room_id, inventory.item_id, inventory.expected_quantity);
        }
      }
      const inventoryPlaceholders = inventoryRows.map(() => '(?, ?, ?)').join(', ');
      const inventoryPerRoom = inventoryRows.length;
      for (let index = 0; index < created.length; index += 1) {
        const start = index * inventoryPerRoom * 3;
        await connection.query(
          `INSERT INTO room_inventory (room_id, item_id, expected_quantity) VALUES ${inventoryPlaceholders}`,
          inventoryValues.slice(start, start + inventoryPerRoom * 3)
        );
      }
    }

    await logAudit({
      userId: req.user.user_id,
      action: ACTIONS.ROOM_BULK_CREATE,
      entityType: ENTITY_TYPES.ROOM,
      entityId: created[0].room_id,
      newValue: { count: created.length, room_numbers: roomNumbers },
      ipAddress: req.ip,
      connection,
    });

    await connection.commit();
    transactionStarted = false;
    committed = true;
    return res.status(201).json({ created });
  } catch (err) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[bulkCreateRooms] Rollback error:', rollbackError.message);
      }
      transactionStarted = false;
    }
    if (uploadedCloudinaryAsset && uploadedImageUrl && !committed) {
      try {
        await deleteImageFromCloudinary(uploadedImageUrl);
      } catch (cleanupError) {
        console.error('[bulkCreateRooms] Cloudinary cleanup error:', cleanupError.message);
      }
    }
    if (err.code === 'ER_DUP_ENTRY') {
      try {
        const normalizedNumbers = roomNumbers.map((number) => number.toLowerCase());
        const [existingRooms] = await pool.query(
          'SELECT room_number FROM Rooms WHERE LOWER(room_number) IN (?)',
          [normalizedNumbers]
        );
        const conflicts = getRoomNumberConflicts(roomNumbers, existingRooms.map((room) => room.room_number));
        return res.status(409).json({ error: 'One or more room numbers already exist.', conflicts });
      } catch (conflictError) {
        console.error('[bulkCreateRooms] Conflict lookup error:', conflictError.message);
        return res.status(409).json({ error: 'One or more room numbers already exist.', conflicts: [] });
      }
    }
    console.error('[bulkCreateRooms] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create rooms.' });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * PUT /api/admin/rooms/:id
 * Updates an existing room. Accepts partial updates — only provided
 * fields are changed.
 */
async function updateRoom(req, res) {
  const { id } = req.params;
  const {
    room_number,
    room_type,
    capacity,
    price_per_night,
    description,
    amenities,
    images,
    status,
    max_extra_beds,
    existing_image_url,
  } = req.body || {};

  try {
    const [existing] = await pool.query(`SELECT * FROM Rooms WHERE room_id = ?`, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const validationError = validateRoomTemplateFields({ capacity, price_per_night, max_extra_beds, status });
    if (validationError) return res.status(400).json({ error: validationError });

    // If changing room_number, make sure it doesn't collide with another room
    if (room_number !== undefined && room_number !== existing[0].room_number) {
      const [duplicate] = await pool.query(
        `SELECT room_id FROM Rooms WHERE room_number = ? AND room_id != ?`,
        [room_number, id]
      );
      if (duplicate.length > 0) {
        return res.status(409).json({ error: `Room number "${room_number}" already exists.` });
      }
    }

    const current = existing[0];

    const imageUrl = req.file
      ? await uploadImageToCloudinary(req.file.buffer, 'kairos/rooms')
      : existing_image_url
        ? await validateExistingImage(pool, existing_image_url, 'kairos/rooms')
        : current.images;
    if (existing_image_url && !imageUrl) return res.status(400).json({ error: 'The selected image is not an approved uploaded image.' });

    const supportsExtraBeds = await hasColumn(pool, 'Rooms', 'max_extra_beds');
    const updateSql = supportsExtraBeds
      ? `UPDATE Rooms SET
        room_number = ?,
        room_type = ?,
        capacity = ?,
        max_extra_beds = ?,
        price_per_night = ?,
        description = ?,
        amenities = ?,
        images = ?,
        status = ?
       WHERE room_id = ?`
      : `UPDATE Rooms SET
        room_number = ?, room_type = ?, capacity = ?, price_per_night = ?,
        description = ?, amenities = ?, images = ?, status = ?
       WHERE room_id = ?`;
    const updateValues = supportsExtraBeds
      ? [
        room_number ?? current.room_number,
        room_type ?? current.room_type,
        capacity ?? current.capacity,
        max_extra_beds === undefined ? (current.max_extra_beds ?? 0) : Number(max_extra_beds),
        price_per_night ?? current.price_per_night,
        description ?? current.description,
        amenities ?? current.amenities,
        imageUrl,
        status ?? current.status,
        id,
      ]
      : [
        room_number ?? current.room_number, room_type ?? current.room_type,
        capacity ?? current.capacity, price_per_night ?? current.price_per_night,
        description ?? current.description, amenities ?? current.amenities,
        imageUrl, status ?? current.status, id,
      ];
    const [updateResult] = await pool.query(updateSql, updateValues);

    const [updated] = await pool.query(`SELECT * FROM Rooms WHERE room_id = ?`, [id]);
    if (!updateResult.affectedRows && !updated.length) {
      return res.status(404).json({ error: 'Room not found.' });
    }
    await logAudit({
      userId: req.user.user_id, action: ACTIONS.ROOM_UPDATE, entityType: ENTITY_TYPES.ROOM, entityId: Number(id),
      oldValue: { room_number: current.room_number, room_type: current.room_type, capacity: current.capacity, price_per_night: current.price_per_night, status: current.status },
      newValue: { room_number: updated[0].room_number, room_type: updated[0].room_type, capacity: updated[0].capacity, price_per_night: updated[0].price_per_night, status: updated[0].status }, ipAddress: req.ip,
    });

    return res.status(200).json({ message: 'Room updated successfully.', room: updated[0] });
  } catch (err) {
    console.error('[updateRoom] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update room.' });
  }
}

async function bulkUpdateRooms(req, res) {
  const request = validateBulkUpdateRequest(req.body, BULK_ROOM_FIELDS);
  if (request.error) return res.status(400).json({ error: request.error });
  const { ids, fields } = request;
  const validationError = validateRoomTemplateFields(fields);
  if (validationError) return res.status(400).json({ error: validationError });

  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [rooms] = await connection.query(
      'SELECT * FROM Rooms WHERE room_id IN (?) FOR UPDATE',
      [ids]
    );
    if (rooms.length !== ids.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'One or more rooms were not found.' });
    }

    const supportsExtraBeds = await hasColumn(connection, 'Rooms', 'max_extra_beds');
    if (Object.hasOwn(fields, 'max_extra_beds') && !supportsExtraBeds) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ error: 'max_extra_beds is not available for these rooms.' });
    }

    let imageUrl;
    if (Object.hasOwn(fields, 'existing_image_url')) {
      imageUrl = await validateExistingImage(connection, fields.existing_image_url, 'kairos/rooms');
      if (!imageUrl) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: 'The selected image is not an approved uploaded image.' });
      }
    }

    const updateFields = Object.keys(fields).map((field) => field === 'existing_image_url' ? 'images' : field);
    const columnFields = updateFields.map((field) => {
      if (!ROOM_BULK_COLUMN_NAMES[field]) throw new Error('Invalid room update field mapping.');
      return ROOM_BULK_COLUMN_NAMES[field];
    });
    const oldValues = [];
    const newValues = [];

    for (const room of rooms) {
      const values = {};
      for (const field of updateFields) {
        if (field === 'images') {
          values.images = imageUrl;
        } else if (field === 'max_extra_beds') {
          values.max_extra_beds = Number(fields.max_extra_beds);
        } else {
          values[field] = fields[field] ?? room[field];
        }
      }
      const changedOld = {};
      const changedNew = {};
      for (const field of updateFields) {
        if (!valuesEqual(room[field], values[field])) {
          changedOld[field] = room[field];
          changedNew[field] = values[field];
        }
      }
      if (columnFields.length) {
        await connection.query(
          `UPDATE Rooms SET ${columnFields.map((column) => `${column} = ?`).join(', ')} WHERE room_id = ?`,
          [...updateFields.map((field) => values[field]), room.room_id]
        );
      }
      if (Object.keys(changedOld).length) {
        oldValues.push({ id: room.room_id, fields: changedOld });
        newValues.push({ id: room.room_id, fields: changedNew });
      }
    }

    const [updatedRooms] = await connection.query(
      'SELECT * FROM Rooms WHERE room_id IN (?)',
      [ids]
    );
    const updatedById = new Map(updatedRooms.map((room) => [room.room_id, room]));
    const orderedRooms = ids.map((id) => updatedById.get(id));

    await logAudit({
      userId: req.user.user_id,
      action: ACTIONS.ROOM_BULK_UPDATE,
      entityType: ENTITY_TYPES.ROOM,
      oldValue: { actor_role: req.user.role, ids, changes: oldValues },
      newValue: { actor_role: req.user.role, ids, changes: newValues },
      ipAddress: req.ip,
      connection,
    });

    await connection.commit();
    transactionStarted = false;
    return res.status(200).json({ count: orderedRooms.length, rooms: orderedRooms });
  } catch (err) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[bulkUpdateRooms] Rollback error:', rollbackError.message);
      }
    }
    console.error('[bulkUpdateRooms] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update rooms.' });
  } finally {
    if (connection) connection.release();
  }
}

/**
 * PATCH /api/admin/rooms/:id/deactivate
 * Soft-deactivate: sets status to 'unavailable' rather than deleting.
 * This is the standard way to "remove" a room per the system's policy —
 * preserves reservation history tied to it.
 */
async function deactivateRoom(req, res) {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(`SELECT * FROM Rooms WHERE room_id = ?`, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    await pool.query(`UPDATE Rooms SET status = 'unavailable' WHERE room_id = ?`, [id]);
    await logAudit({
      userId: req.user.user_id, action: ACTIONS.ROOM_DEACTIVATE, entityType: ENTITY_TYPES.ROOM, entityId: Number(id),
      oldValue: { status: existing[0].status }, newValue: { status: 'unavailable' }, ipAddress: req.ip,
    });

    return res.status(200).json({ message: 'Room deactivated successfully.' });
  } catch (err) {
    console.error('[deactivateRoom] Error:', err.message);
    return res.status(500).json({ error: 'Failed to deactivate room.' });
  }
}

/**
 * PATCH /api/admin/rooms/:id/reactivate
 * Sets status back to 'available'.
 */
async function reactivateRoom(req, res) {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(`SELECT * FROM Rooms WHERE room_id = ?`, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    await pool.query(`UPDATE Rooms SET status = 'available' WHERE room_id = ?`, [id]);

    return res.status(200).json({ message: 'Room reactivated successfully.' });
  } catch (err) {
    console.error('[reactivateRoom] Error:', err.message);
    return res.status(500).json({ error: 'Failed to reactivate room.' });
  }
}

/**
 * DELETE /api/admin/rooms/:id
 * HARD delete — only allowed if the room has zero reservations
 * (past or present). Otherwise, deactivate() should be used instead.
 */
async function deleteRoom(req, res) {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(`SELECT * FROM Rooms WHERE room_id = ?`, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const [reservationCheck] = await pool.query(
      `SELECT COUNT(*) AS count FROM Reservations WHERE room_id = ?`,
      [id]
    );

    if (reservationCheck[0].count > 0) {
      return res.status(409).json({
        error: 'This room has existing reservations and cannot be permanently deleted. Deactivate it instead.',
      });
    }

    await pool.query(`DELETE FROM Rooms WHERE room_id = ?`, [id]);

    return res.status(200).json({ message: 'Room permanently deleted.' });
  } catch (err) {
    console.error('[deleteRoom] Error:', err.message);
    return res.status(500).json({ error: 'Failed to delete room.' });
  }
}

module.exports = {
  getAllRooms,
  getRoomById,
  createRoom,
  bulkCreateRooms,
  bulkUpdateRooms,
  updateRoom,
  deactivateRoom,
  reactivateRoom,
  deleteRoom,
};