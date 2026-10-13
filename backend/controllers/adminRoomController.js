// controllers/adminRoomController.js
const pool = require('../config/db');
const { uploadImageToCloudinary } = require('../utils/cloudinaryUpload');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { hasColumn } = require('../utils/paymentSummary');
const { validateExistingImage } = require('../utils/imageReferences');

const MAX_EXTRA_BEDS_PER_ROOM = 20;

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

  if (Number(capacity) <= 0) {
    return res.status(400).json({ error: 'capacity must be greater than 0.' });
  }

  if (Number(price_per_night) <= 0) {
    return res.status(400).json({ error: 'price_per_night must be greater than 0.' });
  }
  if (max_extra_beds !== undefined && (!Number.isInteger(Number(max_extra_beds)) || Number(max_extra_beds) < 0 || Number(max_extra_beds) > MAX_EXTRA_BEDS_PER_ROOM)) {
    return res.status(400).json({ error: `max_extra_beds must be an integer from 0 to ${MAX_EXTRA_BEDS_PER_ROOM}.` });
  }

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

    if (capacity !== undefined && Number(capacity) <= 0) {
      return res.status(400).json({ error: 'capacity must be greater than 0.' });
    }

    if (price_per_night !== undefined && Number(price_per_night) <= 0) {
      return res.status(400).json({ error: 'price_per_night must be greater than 0.' });
    }
    if (max_extra_beds !== undefined && (!Number.isInteger(Number(max_extra_beds)) || Number(max_extra_beds) < 0 || Number(max_extra_beds) > MAX_EXTRA_BEDS_PER_ROOM)) {
      return res.status(400).json({ error: `max_extra_beds must be an integer from 0 to ${MAX_EXTRA_BEDS_PER_ROOM}.` });
    }

    if (status !== undefined && !['available', 'unavailable', 'maintenance'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

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
  updateRoom,
  deactivateRoom,
  reactivateRoom,
  deleteRoom,
};