// controllers/adminVenueController.js
const pool = require('../config/db');
const { uploadImageToCloudinary, deleteImageFromCloudinary } = require('../utils/cloudinaryUpload');
const logAudit = require('../utils/logAudit');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const { parseInclusions } = require('../utils/venueBooking');
const { validateExistingImage } = require('../utils/imageReferences');
const { validateBulkUpdateRequest, valuesEqual } = require('../utils/adminBulkUpdate');

const VENUE_STATUSES = ['available', 'unavailable', 'maintenance'];
const BULK_VENUE_FIELDS = new Set([
  'venue_type', 'capacity', 'description', 'amenities', 'status', 'existing_image_url',
  'flat_price', 'start_time', 'end_time', 'earliest_start', 'latest_end',
  'slot_step_minutes', 'buffer_minutes',
]);
const VENUE_RULE_FIELDS = new Set([
  'flat_price', 'start_time', 'end_time', 'earliest_start', 'latest_end',
  'slot_step_minutes', 'buffer_minutes',
]);
const VENUE_BULK_COLUMN_NAMES = Object.freeze({
  venue_type: 'venue_type',
  capacity: 'capacity',
  description: 'description',
  amenities: 'amenities',
  status: 'status',
  images: 'images',
  flat_price: 'flat_price',
  start_time: 'start_time',
  end_time: 'end_time',
  earliest_start: 'earliest_start',
  latest_end: 'latest_end',
  slot_step_minutes: 'slot_step_minutes',
  buffer_minutes: 'buffer_minutes',
});

function parseTimeMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function validateVenueUpdateFields(fields, current) {
  if (fields.capacity !== undefined && (!Number.isFinite(Number(fields.capacity)) || Number(fields.capacity) <= 0)) {
    return 'capacity must be greater than 0.';
  }
  if (fields.status !== undefined && !VENUE_STATUSES.includes(fields.status)) {
    return 'Invalid status value.';
  }
  if (fields.booking_mode !== undefined && !['day_use', 'packaged'].includes(fields.booking_mode)) {
    return 'Invalid booking mode.';
  }
  if (fields.slot_step_minutes !== undefined && (!Number.isInteger(Number(fields.slot_step_minutes)) || Number(fields.slot_step_minutes) <= 0)) {
    return 'slot_step_minutes must be a positive integer.';
  }
  if (fields.buffer_minutes !== undefined && (!Number.isInteger(Number(fields.buffer_minutes)) || Number(fields.buffer_minutes) < 0)) {
    return 'buffer_minutes must be a non-negative integer.';
  }
  const bookingMode = fields.booking_mode ?? current.booking_mode;
  if (fields.flat_price !== undefined) {
    if (bookingMode === 'day_use' && (fields.flat_price === '' || fields.flat_price === null)) {
      return 'flat_price must be greater than 0.';
    }
    if (fields.flat_price !== '' && fields.flat_price !== null
      && (!Number.isFinite(Number(fields.flat_price)) || Number(fields.flat_price) <= 0)) {
      return 'flat_price must be greater than 0.';
    }
  }

  for (const [startField, endField] of [['start_time', 'end_time'], ['earliest_start', 'latest_end']]) {
    const start = fields[startField] ?? current[startField];
    const end = fields[endField] ?? current[endField];
    if (fields[startField] !== undefined && parseTimeMinutes(fields[startField]) === null) {
      return `${startField} must be a valid time.`;
    }
    if (fields[endField] !== undefined && parseTimeMinutes(fields[endField]) === null) {
      return `${endField} must be a valid time.`;
    }
    const startMinutes = parseTimeMinutes(start);
    const endMinutes = parseTimeMinutes(end);
    if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
      return `${startField} must be earlier than ${endField}.`;
    }
  }
  return null;
}
function validateVenueTemplate({ venue_type, capacity }) {
  if (!venue_type || !capacity) return 'venue_type and capacity are required.';
  if (!Number.isFinite(Number(capacity)) || Number(capacity) <= 0) return 'capacity must be greater than 0.';
  return null;
}

function parseVenueNames(value) {
  if (typeof value !== 'string') return null;
  try {
    const names = JSON.parse(value);
    if (!Array.isArray(names) || names.length < 1 || names.length > 50) return null;
    if (!names.every((name) => typeof name === 'string' && name.trim() && Array.from(name.trim()).length <= 100)) return null;
    const trimmedNames = names.map((name) => name.trim());
    if (new Set(trimmedNames.map((name) => name.toLowerCase())).size !== trimmedNames.length) return null;
    return trimmedNames;
  } catch {
    return null;
  }
}

function getVenueNameConflicts(names, existingNames) {
  const existing = new Set(existingNames.map((name) => name.toLowerCase()));
  return names.filter((name) => existing.has(name.toLowerCase()));
}

function venueCreateValues(body, imageUrl, venueName) {
  return [
    venueName,
    body.venue_type,
    Number(body.capacity),
    body.description || null,
    body.amenities || null,
    imageUrl,
    body.booking_mode || 'day_use',
    body.start_time || null,
    body.end_time || null,
    body.earliest_start || null,
    body.latest_end || null,
    Number(body.slot_step_minutes || 30),
    Number(body.buffer_minutes || 0),
    body.flat_price === '' ? null : (body.flat_price ?? null),
  ];
}

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
  const validationError = validateVenueTemplate({ venue_type, capacity });
  if (validationError) return res.status(400).json({ error: validationError });

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
      venueCreateValues(req.body || {}, imageUrl, venue_name)
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

async function bulkCreateVenues(req, res) {
  const body = req.body || {};
  const venueNames = parseVenueNames(body.venue_names);
  if (!venueNames) {
    return res.status(400).json({ error: 'venue_names must be a JSON array of 1 to 50 unique venue names, each 1 to 100 characters.' });
  }
  const validationError = validateVenueTemplate(body);
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

    const [existingVenues] = await connection.query(
      'SELECT venue_name FROM Venues WHERE LOWER(venue_name) IN (?)',
      [venueNames.map((name) => name.toLowerCase())]
    );
    const conflicts = getVenueNameConflicts(venueNames, existingVenues.map((venue) => venue.venue_name));
    if (conflicts.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: 'One or more venue names already exist.', conflicts });
    }

    if (req.file) {
      uploadedImageUrl = await uploadImageToCloudinary(req.file.buffer, 'kairos/venues');
      uploadedCloudinaryAsset = true;
    } else if (body.existing_image_url) {
      uploadedImageUrl = await validateExistingImage(connection, body.existing_image_url, 'kairos/venues');
      if (!uploadedImageUrl) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: 'The selected image is not an approved uploaded image.' });
      }
    }

    const values = venueNames.flatMap((name) => venueCreateValues(body, uploadedImageUrl, name));
    const venuePlaceholders = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    await connection.query(
      `INSERT INTO Venues
        (venue_name, venue_type, capacity, description, amenities, images, booking_mode,
         start_time, end_time, earliest_start, latest_end, slot_step_minutes, buffer_minutes, flat_price)
       VALUES ${venueNames.map(() => venuePlaceholders).join(', ')}`,
      values
    );

    const [createdRows] = await connection.query(
      'SELECT * FROM Venues WHERE LOWER(venue_name) IN (?)',
      [venueNames.map((name) => name.toLowerCase())]
    );
    const createdByName = new Map(createdRows.map((venue) => [venue.venue_name.toLowerCase(), venue]));
    const created = venueNames.map((name) => createdByName.get(name.toLowerCase()));
    if (created.some((venue) => !venue)) throw new Error('Created venues could not be reloaded.');

    await logAudit({
      userId: req.user.user_id,
      action: ACTIONS.VENUE_BULK_CREATE,
      entityType: ENTITY_TYPES.VENUE,
      entityId: created[0].venue_id,
      newValue: { count: created.length, venue_names: venueNames },
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
        console.error('[bulkCreateVenues] Rollback error:', rollbackError.message);
      }
      transactionStarted = false;
    }
    if (uploadedCloudinaryAsset && uploadedImageUrl && !committed) {
      try {
        await deleteImageFromCloudinary(uploadedImageUrl);
      } catch (cleanupError) {
        console.error('[bulkCreateVenues] Cloudinary cleanup error:', cleanupError.message);
      }
    }
    console.error('[bulkCreateVenues] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create venues.' });
  } finally {
    if (connection) connection.release();
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

    const validationError = validateVenueUpdateFields({
      capacity, status, booking_mode, slot_step_minutes, buffer_minutes, flat_price,
      start_time, end_time, earliest_start, latest_end,
    }, existing[0]);
    if (validationError) return res.status(400).json({ error: validationError });

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

async function bulkUpdateVenues(req, res) {
  const request = validateBulkUpdateRequest(req.body, BULK_VENUE_FIELDS);
  if (request.error) return res.status(400).json({ error: request.error });
  const { ids, fields } = request;
  const includesRuleFields = Object.keys(fields).some((field) => VENUE_RULE_FIELDS.has(field));

  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [venues] = await connection.query(
      'SELECT * FROM Venues WHERE venue_id IN (?) FOR UPDATE',
      [ids]
    );
    if (venues.length !== ids.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'One or more venues were not found.' });
    }

    const bookingModes = new Set(venues.map((venue) => venue.booking_mode));
    if (includesRuleFields && bookingModes.size !== 1) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ error: 'Select venues with the same booking type to edit booking rules.' });
    }
    if (includesRuleFields) {
      const bookingMode = venues[0].booking_mode;
      const dayUseOnlyFields = ['flat_price', 'start_time', 'end_time'];
      const packagedOnlyFields = ['earliest_start', 'latest_end'];
      if (bookingMode === 'day_use' && Object.keys(fields).some((field) => packagedOnlyFields.includes(field))) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: 'One or more fields do not apply to the selected booking type.' });
      }
      if (bookingMode === 'packaged' && Object.keys(fields).some((field) => dayUseOnlyFields.includes(field))) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: 'One or more fields do not apply to the selected booking type.' });
      }
    }

    for (const venue of venues) {
      const validationError = validateVenueUpdateFields(fields, venue);
      if (validationError) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: validationError });
      }
    }

    let imageUrl;
    if (Object.hasOwn(fields, 'existing_image_url')) {
      imageUrl = await validateExistingImage(connection, fields.existing_image_url, 'kairos/venues');
      if (!imageUrl) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: 'The selected image is not an approved uploaded image.' });
      }
    }

    const updateFields = Object.keys(fields).map((field) => field === 'existing_image_url' ? 'images' : field);
    const columnFields = updateFields.map((field) => {
      if (!VENUE_BULK_COLUMN_NAMES[field]) throw new Error('Invalid venue update field mapping.');
      return VENUE_BULK_COLUMN_NAMES[field];
    });
    const oldValues = [];
    const newValues = [];

    for (const venue of venues) {
      const values = {};
      for (const field of updateFields) {
        if (field === 'images') {
          values.images = imageUrl;
        } else if (field === 'slot_step_minutes' || field === 'buffer_minutes') {
          values[field] = Number(fields[field]);
        } else if (field === 'flat_price') {
          values.flat_price = fields.flat_price === '' ? null : Number(fields.flat_price);
        } else {
          values[field] = fields[field] ?? venue[field];
        }
      }
      const changedOld = {};
      const changedNew = {};
      for (const field of updateFields) {
        if (!valuesEqual(venue[field], values[field])) {
          changedOld[field] = venue[field];
          changedNew[field] = values[field];
        }
      }
      if (columnFields.length) {
        await connection.query(
          `UPDATE Venues SET ${columnFields.map((column) => `${column} = ?`).join(', ')} WHERE venue_id = ?`,
          [...updateFields.map((field) => values[field]), venue.venue_id]
        );
      }
      if (Object.keys(changedOld).length) {
        oldValues.push({ id: venue.venue_id, fields: changedOld });
        newValues.push({ id: venue.venue_id, fields: changedNew });
      }
    }

    const [updatedVenues] = await connection.query(
      'SELECT * FROM Venues WHERE venue_id IN (?)',
      [ids]
    );
    const updatedById = new Map(updatedVenues.map((venue) => [venue.venue_id, venue]));
    const orderedVenues = ids.map((id) => updatedById.get(id));

    await logAudit({
      userId: req.user.user_id,
      action: ACTIONS.VENUE_BULK_UPDATE,
      entityType: ENTITY_TYPES.VENUE,
      oldValue: { actor_role: req.user.role, ids, changes: oldValues },
      newValue: { actor_role: req.user.role, ids, changes: newValues },
      ipAddress: req.ip,
      connection,
    });

    await connection.commit();
    transactionStarted = false;
    return res.status(200).json({ count: orderedVenues.length, venues: orderedVenues });
  } catch (err) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('[bulkUpdateVenues] Rollback error:', rollbackError.message);
      }
    }
    console.error('[bulkUpdateVenues] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update venues.' });
  } finally {
    if (connection) connection.release();
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
  bulkCreateVenues,
  bulkUpdateVenues,
  updateVenue,
  deactivateVenue,
  reactivateVenue,
  deleteVenue,
  listPackages,
  createPackage,
  updatePackage,
  deactivatePackage,
};