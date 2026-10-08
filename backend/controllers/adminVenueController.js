// controllers/adminVenueController.js
const pool = require('../config/db');
const { uploadImageToCloudinary } = require('../utils/cloudinaryUpload');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');

async function getAllVenues(req, res) {
  try {
    const [venues] = await pool.query(`SELECT * FROM Venues ORDER BY venue_name ASC`);
    return res.status(200).json({ count: venues.length, venues });
  } catch (err) {
    console.error('[getAllVenues] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch venues.' });
  }
}

async function getVenueById(req, res) {
  const { id } = req.params;

  try {
    const [venues] = await pool.query(`SELECT * FROM Venues WHERE venue_id = ?`, [id]);

    if (venues.length === 0) {
      return res.status(404).json({ error: 'Venue not found.' });
    }

    return res.status(200).json({ venue: venues[0] });
  } catch (err) {
    console.error('[getVenueById] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch venue.' });
  }
}

async function createVenue(req, res) {
  const { venue_name, venue_type, capacity, description, amenities, images } = req.body;

  if (!venue_name || !venue_type || !capacity) {
    return res.status(400).json({
      error: 'venue_name, venue_type, and capacity are required.',
    });
  }

  if (Number(capacity) <= 0) {
    return res.status(400).json({ error: 'capacity must be greater than 0.' });
  }

  try {
    const [existing] = await pool.query(
      `SELECT venue_id FROM Venues WHERE venue_name = ?`,
      [venue_name]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: `Venue "${venue_name}" already exists.` });
    }

    const imageUrl = req.file
      ? await uploadImageToCloudinary(req.file.buffer, 'kairos/venues')
      : null;

    const [result] = await pool.query(
      `INSERT INTO Venues (venue_name, venue_type, capacity, description, amenities, images, status)
       VALUES (?, ?, ?, ?, ?, ?, 'available')`,
      [venue_name, venue_type, capacity, description || null, amenities || null, imageUrl]
    );

    const [newVenue] = await pool.query(`SELECT * FROM Venues WHERE venue_id = ?`, [result.insertId]);
    await logAudit({
      userId: req.user.user_id, action: ACTIONS.VENUE_CREATE, entityType: ENTITY_TYPES.VENUE, entityId: result.insertId,
      newValue: { venue_name, venue_type, capacity, status: 'available' }, ipAddress: req.ip,
    });

    return res.status(201).json({ message: 'Venue created successfully.', venue: newVenue[0] });
  } catch (err) {
    console.error('[createVenue] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create venue.' });
  }
}

async function updateVenue(req, res) {
  const { id } = req.params;
  const { venue_name, venue_type, capacity, description, amenities, images, status } = req.body;

  try {
    const [existing] = await pool.query(`SELECT * FROM Venues WHERE venue_id = ?`, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Venue not found.' });
    }

    if (capacity !== undefined && Number(capacity) <= 0) {
      return res.status(400).json({ error: 'capacity must be greater than 0.' });
    }

    if (status !== undefined && !['available', 'unavailable', 'maintenance'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    if (venue_name !== undefined && venue_name !== existing[0].venue_name) {
      const [duplicate] = await pool.query(
        `SELECT venue_id FROM Venues WHERE venue_name = ? AND venue_id != ?`,
        [venue_name, id]
      );
      if (duplicate.length > 0) {
        return res.status(409).json({ error: `Venue "${venue_name}" already exists.` });
      }
    }

    const current = existing[0];

    const imageUrl = req.file
      ? await uploadImageToCloudinary(req.file.buffer, 'kairos/venues')
      : current.images;

    await pool.query(
      `UPDATE Venues SET
        venue_name = ?,
        venue_type = ?,
        capacity = ?,
        description = ?,
        amenities = ?,
        images = ?,
        status = ?
       WHERE venue_id = ?`,
      [
        venue_name ?? current.venue_name,
        venue_type ?? current.venue_type,
        capacity ?? current.capacity,
        description ?? current.description,
        amenities ?? current.amenities,
        imageUrl,
        status ?? current.status,
        id,
      ]
    );

    const [updated] = await pool.query(`SELECT * FROM Venues WHERE venue_id = ?`, [id]);
    await logAudit({
      userId: req.user.user_id, action: ACTIONS.VENUE_UPDATE, entityType: ENTITY_TYPES.VENUE, entityId: Number(id),
      oldValue: { venue_name: current.venue_name, venue_type: current.venue_type, capacity: current.capacity, status: current.status },
      newValue: { venue_name: updated[0].venue_name, venue_type: updated[0].venue_type, capacity: updated[0].capacity, status: updated[0].status }, ipAddress: req.ip,
    });

    return res.status(200).json({ message: 'Venue updated successfully.', venue: updated[0] });
  } catch (err) {
    console.error('[updateVenue] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update venue.' });
  }
}

async function deactivateVenue(req, res) {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(`SELECT * FROM Venues WHERE venue_id = ?`, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Venue not found.' });
    }

    await pool.query(`UPDATE Venues SET status = 'unavailable' WHERE venue_id = ?`, [id]);
    await logAudit({
      userId: req.user.user_id, action: ACTIONS.VENUE_DEACTIVATE, entityType: ENTITY_TYPES.VENUE, entityId: Number(id),
      oldValue: { status: existing[0].status }, newValue: { status: 'unavailable' }, ipAddress: req.ip,
    });

    return res.status(200).json({ message: 'Venue deactivated successfully.' });
  } catch (err) {
    console.error('[deactivateVenue] Error:', err.message);
    return res.status(500).json({ error: 'Failed to deactivate venue.' });
  }
}

async function reactivateVenue(req, res) {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(`SELECT * FROM Venues WHERE venue_id = ?`, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Venue not found.' });
    }

    await pool.query(`UPDATE Venues SET status = 'available' WHERE venue_id = ?`, [id]);

    return res.status(200).json({ message: 'Venue reactivated successfully.' });
  } catch (err) {
    console.error('[reactivateVenue] Error:', err.message);
    return res.status(500).json({ error: 'Failed to reactivate venue.' });
  }
}

async function deleteVenue(req, res) {
  const { id } = req.params;

  try {
    const [existing] = await pool.query(`SELECT * FROM Venues WHERE venue_id = ?`, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Venue not found.' });
    }

    const [reservationCheck] = await pool.query(
      `SELECT COUNT(*) AS count FROM Reservations WHERE venue_id = ?`,
      [id]
    );

    if (reservationCheck[0].count > 0) {
      return res.status(409).json({
        error: 'This venue has existing reservations and cannot be permanently deleted. Deactivate it instead.',
      });
    }

    await pool.query(`DELETE FROM Venues WHERE venue_id = ?`, [id]);

    return res.status(200).json({ message: 'Venue permanently deleted.' });
  } catch (err) {
    console.error('[deleteVenue] Error:', err.message);
    return res.status(500).json({ error: 'Failed to delete venue.' });
  }
}

module.exports = {
  getAllVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deactivateVenue,
  reactivateVenue,
  deleteVenue,
};