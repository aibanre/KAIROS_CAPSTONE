// controllers/adminVenueController.js
const pool = require('../config/db');
const { uploadImageToCloudinary } = require('../utils/cloudinaryUpload');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { parseInclusions } = require('../utils/venueBooking');
const { validateExistingImage } = require('../utils/imageReferences');

function packageId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function packagePayload(body = {}) {
  const name = typeof body.package_name === 'string' ? body.package_name.trim() : '';
  const pricingType = body.pricing_type;
  const price = Number(body.price);
  const minPax = Number(body.min_pax);
  const maxPax = body.max_pax === '' || body.max_pax === null || body.max_pax === undefined ? null : Number(body.max_pax);
  const includedHours = Number(body.included_hours);
  const extraHourRate = body.extra_hour_rate === '' || body.extra_hour_rate === null || body.extra_hour_rate === undefined
    ? null
    : Number(body.extra_hour_rate);
  const sortOrder = Number(body.sort_order);
  const inclusions = Array.isArray(body.inclusions)
    ? body.inclusions.map(String).map((item) => item.trim()).filter(Boolean)
    : parseInclusions(body.inclusions);

  if (!name || !['flat', 'per_person'].includes(pricingType) || !Number.isFinite(price) || price <= 0
    || !Number.isInteger(minPax) || minPax < 1 || (maxPax !== null && (!Number.isInteger(maxPax) || maxPax < minPax))
    || !Number.isFinite(includedHours) || includedHours <= 0
    || (extraHourRate !== null && (!Number.isFinite(extraHourRate) || extraHourRate < 0))
    || !Number.isInteger(sortOrder)) {
    return null;
  }

  return {
    name,
    description: typeof body.description === 'string' ? body.description.trim() : '',
    inclusions,
    pricingType,
    price,
    minPax,
    maxPax,
    includedHours,
    extraHourRate,
    sortOrder,
  };
}

async function venueExists(venueId) {
  const [[venue]] = await pool.query('SELECT venue_id FROM Venues WHERE venue_id = ?', [venueId]);
  return Boolean(venue);
}

function packageResponse(pkg) {
  return { ...pkg, inclusions: parseInclusions(pkg.inclusions) };
}

async function listPackages(req, res) {
  const venueId = packageId(req.params.id);
  if (!venueId) return res.status(400).json({ error: 'Invalid venue ID.' });
  try {
    if (!(await venueExists(venueId))) return res.status(404).json({ error: 'Venue not found.' });
    const [packages] = await pool.query(
      'SELECT * FROM Venue_Packages WHERE venue_id = ? AND is_active = TRUE ORDER BY sort_order, package_id',
      [venueId]
    );
    return res.set('Cache-Control', 'no-store').json({ packages: packages.map(packageResponse) });
  } catch (err) {
    console.error('[listPackages] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch venue packages.' });
  }
}

async function createPackage(req, res) {
  const venueId = packageId(req.params.id);
  const payload = packagePayload(req.body);
  if (!venueId || !payload) return res.status(400).json({ error: 'A valid package name, pricing, pax range, and schedule are required.' });
  try {
    if (!(await venueExists(venueId))) return res.status(404).json({ error: 'Venue not found.' });
    const [result] = await pool.query(
      `INSERT INTO Venue_Packages
        (venue_id, package_name, description, inclusions, pricing_type, price, min_pax, max_pax, included_hours, extra_hour_rate, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [venueId, payload.name, payload.description || null, JSON.stringify(payload.inclusions), payload.pricingType, payload.price,
        payload.minPax, payload.maxPax, payload.includedHours, payload.extraHourRate, payload.sortOrder]
    );
    const [[created]] = await pool.query('SELECT * FROM Venue_Packages WHERE package_id = ?', [result.insertId]);
    return res.status(201).json({ package: packageResponse(created) });
  } catch (err) {
    console.error('[createPackage] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create venue package.' });
  }
}

async function updatePackage(req, res) {
  const venueId = packageId(req.params.id);
  const packageIdValue = packageId(req.params.packageId);
  const payload = packagePayload(req.body);
  if (!venueId || !packageIdValue || !payload) return res.status(400).json({ error: 'A valid package name, pricing, pax range, and schedule are required.' });
  try {
    const [[existing]] = await pool.query(
      'SELECT * FROM Venue_Packages WHERE package_id = ? AND venue_id = ? AND is_active = TRUE',
      [packageIdValue, venueId]
    );
    if (!existing) return res.status(404).json({ error: 'Venue package not found.' });
    await pool.query(
      `UPDATE Venue_Packages SET package_name = ?, description = ?, inclusions = ?, pricing_type = ?, price = ?,
        min_pax = ?, max_pax = ?, included_hours = ?, extra_hour_rate = ?, sort_order = ? WHERE package_id = ? AND venue_id = ?`,
      [payload.name, payload.description || null, JSON.stringify(payload.inclusions), payload.pricingType, payload.price,
        payload.minPax, payload.maxPax, payload.includedHours, payload.extraHourRate, payload.sortOrder, packageIdValue, venueId]
    );
    const [[updated]] = await pool.query('SELECT * FROM Venue_Packages WHERE package_id = ?', [packageIdValue]);
    return res.json({ package: packageResponse(updated) });
  } catch (err) {
    console.error('[updatePackage] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update venue package.' });
  }
}

async function deactivatePackage(req, res) {
  const venueId = packageId(req.params.id);
  const packageIdValue = packageId(req.params.packageId);
  if (!venueId || !packageIdValue) return res.status(400).json({ error: 'Invalid venue package ID.' });
  try {
    const [result] = await pool.query(
      'UPDATE Venue_Packages SET is_active = FALSE WHERE package_id = ? AND venue_id = ? AND is_active = TRUE',
      [packageIdValue, venueId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Venue package not found.' });
    return res.json({ message: 'Venue package deactivated.' });
  } catch (err) {
    console.error('[deactivatePackage] Error:', err.message);
    return res.status(500).json({ error: 'Failed to deactivate venue package.' });
  }
}

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
  const {
    venue_name, venue_type, capacity, description, amenities, images, booking_mode,
    start_time, end_time, earliest_start, latest_end, slot_step_minutes, buffer_minutes, flat_price,
    existing_image_url,
  } = req.body || {};

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
      : existing_image_url
        ? await validateExistingImage(pool, existing_image_url, 'kairos/venues')
        : null;
    if (existing_image_url && !imageUrl) return res.status(400).json({ error: 'The selected image is not an approved uploaded image.' });

    const [result] = await pool.query(
      `INSERT INTO Venues
        (venue_name, venue_type, capacity, description, amenities, images, status, booking_mode,
         start_time, end_time, earliest_start, latest_end, slot_step_minutes, buffer_minutes, flat_price)
       VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [venue_name, venue_type, Number(capacity), description || null, amenities || null, imageUrl,
        booking_mode || 'day_use', start_time || null, end_time || null, earliest_start || null, latest_end || null,
        Number(slot_step_minutes || 30), Number(buffer_minutes || 0), flat_price === '' ? null : (flat_price ?? null)]
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
  const {
    venue_name, venue_type, capacity, description, amenities, images, status, booking_mode,
    start_time, end_time, earliest_start, latest_end, slot_step_minutes, buffer_minutes, flat_price,
    existing_image_url,
  } = req.body || {};

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
    if (booking_mode !== undefined && !['day_use', 'packaged'].includes(booking_mode)) {
      return res.status(400).json({ error: 'Invalid booking mode.' });
    }
    if (slot_step_minutes !== undefined && (!Number.isInteger(Number(slot_step_minutes)) || Number(slot_step_minutes) <= 0)) {
      return res.status(400).json({ error: 'slot_step_minutes must be a positive integer.' });
    }
    if (buffer_minutes !== undefined && (!Number.isInteger(Number(buffer_minutes)) || Number(buffer_minutes) < 0)) {
      return res.status(400).json({ error: 'buffer_minutes must be a non-negative integer.' });
    }
    if (flat_price !== undefined && flat_price !== '' && Number(flat_price) <= 0) {
      return res.status(400).json({ error: 'flat_price must be greater than 0.' });
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
      : existing_image_url
        ? await validateExistingImage(pool, existing_image_url, 'kairos/venues')
        : current.images;
    if (existing_image_url && !imageUrl) return res.status(400).json({ error: 'The selected image is not an approved uploaded image.' });

    const [updateResult] = await pool.query(
      `UPDATE Venues SET
        venue_name = ?,
        venue_type = ?,
        capacity = ?,
        description = ?,
        amenities = ?,
        images = ?,
        status = ?,
        booking_mode = ?,
        start_time = ?,
        end_time = ?,
        earliest_start = ?,
        latest_end = ?,
        slot_step_minutes = ?,
        buffer_minutes = ?,
        flat_price = ?
       WHERE venue_id = ?`,
      [
        venue_name ?? current.venue_name,
        venue_type ?? current.venue_type,
        capacity ?? current.capacity,
        description ?? current.description,
        amenities ?? current.amenities,
        imageUrl,
        status ?? current.status,
        booking_mode ?? current.booking_mode,
        start_time ?? current.start_time,
        end_time ?? current.end_time,
        earliest_start ?? current.earliest_start,
        latest_end ?? current.latest_end,
        slot_step_minutes === undefined ? current.slot_step_minutes : Number(slot_step_minutes),
        buffer_minutes === undefined ? current.buffer_minutes : Number(buffer_minutes),
        flat_price === undefined ? current.flat_price : (flat_price === '' ? null : Number(flat_price)),
        id,
      ]
    );

    const [updated] = await pool.query(`SELECT * FROM Venues WHERE venue_id = ?`, [id]);
    if (!updateResult.affectedRows && !updated.length) {
      return res.status(404).json({ error: 'Venue not found.' });
    }
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
  listPackages,
  createPackage,
  updatePackage,
  deactivatePackage,
};