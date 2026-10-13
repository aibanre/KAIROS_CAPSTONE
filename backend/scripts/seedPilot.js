require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const inputPath = process.argv[2] || path.join(__dirname, 'pilotData.json');

function required(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function json(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

async function seedPilot() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Pilot data file not found: ${inputPath}. Copy pilotData.example.json to pilotData.json first.`);
  }
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const connection = await pool.getConnection();
  const counts = { rooms: 0, venues: 0, packages: 0, paymentMethods: 0, resortSettings: 0, deactivated: 0 };

  try {
    await connection.beginTransaction();
    const resort = required(data.resort, 'resort');
    await connection.query(
      `INSERT INTO ResortSettings (settings_id, resort_name, address, contact_number, email)
       VALUES (1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE resort_name = VALUES(resort_name), address = VALUES(address),
         contact_number = VALUES(contact_number), email = VALUES(email)`,
      [required(resort.name, 'resort.name'), required(resort.address, 'resort.address'),
        required(resort.contact_number, 'resort.contact_number'), required(resort.email, 'resort.email')]
    );
    counts.resortSettings = 1;

    const rooms = data.rooms || [];
    const roomNumbers = [];
    for (const room of rooms) {
      required(room.number, 'rooms[].number');
      roomNumbers.push(String(room.number));
      await connection.query(
        `INSERT INTO Rooms
          (room_number, room_type, price_per_night, capacity, description, amenities, max_extra_beds, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE room_type = VALUES(room_type), price_per_night = VALUES(price_per_night),
           capacity = VALUES(capacity), description = VALUES(description), amenities = VALUES(amenities),
           max_extra_beds = VALUES(max_extra_beds), status = VALUES(status)`,
        [room.number, required(room.type, 'rooms[].type'), required(room.price_per_night, 'rooms[].price_per_night'),
          required(room.capacity, 'rooms[].capacity'), room.description || null,
          Array.isArray(room.amenities) ? room.amenities.join(', ') : (room.amenities || null),
          room.max_extra_beds || 0, room.status || 'available']
      );
      counts.rooms += 1;
    }
    if (roomNumbers.length) {
      const placeholders = roomNumbers.map(() => '?').join(',');
      const [result] = await connection.query(
        `UPDATE Rooms SET status = 'unavailable' WHERE room_number NOT IN (${placeholders})`,
        roomNumbers
      );
      counts.deactivated += result.affectedRows;
    }

    const venues = data.venues || [];
    const venueNames = [];
    const packages = data.conference_hall_packages || [];
    for (const venue of venues) {
      required(venue.name, 'venues[].name');
      venueNames.push(String(venue.name));
      const [existing] = await connection.query('SELECT venue_id FROM Venues WHERE venue_name = ? LIMIT 1', [venue.name]);
      const values = [venue.name, required(venue.type, 'venues[].type'), required(venue.capacity, 'venues[].capacity'),
        venue.description || null, Array.isArray(venue.amenities) ? venue.amenities.join(', ') : (venue.amenities || null),
        venue.status || 'available', venue.booking_mode || 'day_use', venue.start_time || null, venue.end_time || null,
        venue.earliest_start || null, venue.latest_end || null, venue.slot_step_minutes || 30,
        venue.buffer_minutes || 0, venue.flat_price ?? null];
      if (existing.length) {
        await connection.query(
          `UPDATE Venues SET venue_type=?, capacity=?, description=?, amenities=?, status=?, booking_mode=?,
            start_time=?, end_time=?, earliest_start=?, latest_end=?, slot_step_minutes=?, buffer_minutes=?, flat_price=?
           WHERE venue_id=?`, [...values.slice(1), existing[0].venue_id]
        );
      } else {
        await connection.query(
          `INSERT INTO Venues
            (venue_name, venue_type, capacity, description, amenities, status, booking_mode, start_time, end_time,
             earliest_start, latest_end, slot_step_minutes, buffer_minutes, flat_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values
        );
      }
      counts.venues += 1;
    }
    if (venueNames.length) {
      const placeholders = venueNames.map(() => '?').join(',');
      const [result] = await connection.query(
        `UPDATE Venues SET status = 'unavailable' WHERE venue_name NOT IN (${placeholders})`,
        venueNames
      );
      counts.deactivated += result.affectedRows;
    }

    const [hall] = await connection.query("SELECT venue_id FROM Venues WHERE venue_name = 'Conference Hall' LIMIT 1");
    for (let index = 0; index < packages.length; index += 1) {
      const item = packages[index];
      required(item.name, 'conference_hall_packages[].name');
      if (!hall.length) throw new Error('Conference Hall must be present before adding its packages.');
      const inclusions = json(item.inclusions);
      const [existing] = await connection.query(
        'SELECT package_id FROM Venue_Packages WHERE venue_id = ? AND package_name = ? LIMIT 1',
        [hall[0].venue_id, item.name]
      );
      const values = [item.description || null, inclusions, required(item.pricing_type, 'package.pricing_type'),
        required(item.price, 'package.price'), item.min_pax || 1, item.max_pax ?? null,
        required(item.included_hours, 'package.included_hours'), item.extra_hour_rate ?? null, item.sort_order ?? index + 1];
      if (existing.length) {
        await connection.query(
          `UPDATE Venue_Packages SET description=?, inclusions=?, pricing_type=?, price=?, min_pax=?, max_pax=?,
            included_hours=?, extra_hour_rate=?, sort_order=?, is_active=TRUE WHERE package_id=?`,
          [...values, existing[0].package_id]
        );
      } else {
        await connection.query(
          `INSERT INTO Venue_Packages
            (venue_id, package_name, description, inclusions, pricing_type, price, min_pax, max_pax,
             included_hours, extra_hour_rate, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [hall[0].venue_id, item.name, ...values]
        );
      }
      counts.packages += 1;
    }
    if (packages.length && hall.length) {
      const names = packages.map((item) => item.name);
      const placeholders = names.map(() => '?').join(',');
      const [result] = await connection.query(
        `UPDATE Venue_Packages SET is_active=FALSE
         WHERE venue_id=? AND package_name NOT IN (${placeholders})`,
        [hall[0].venue_id, ...names]
      );
      counts.deactivated += result.affectedRows;
    }
    if (venueNames.length) {
      const placeholders = venueNames.map(() => '?').join(',');
      const [result] = await connection.query(
        `UPDATE Venue_Packages p
         INNER JOIN Venues v ON v.venue_id = p.venue_id
         SET p.is_active=FALSE WHERE v.venue_name NOT IN (${placeholders})`,
        venueNames
      );
      counts.deactivated += result.affectedRows;
    }

    for (const method of data.payment_methods || []) {
      required(method.name, 'payment_methods[].name');
      await connection.query(
        `INSERT INTO PaymentMethods (method_name, method_type, account_name, account_number, is_active)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE method_type=VALUES(method_type), account_name=VALUES(account_name),
           account_number=VALUES(account_number), is_active=VALUES(is_active)`,
        [method.name, required(method.type, 'payment_methods[].type'), method.account_name || null,
          method.account_number || null, method.is_active !== false]
      );
      counts.paymentMethods += 1;
    }
    await connection.commit();
    console.log(`[seedPilot] Seeded ${inputPath}`);
    console.log(`[seedPilot] Summary: ${JSON.stringify(counts)}`);
    console.log('[seedPilot] Existing rows were updated or deactivated; no rows were deleted.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedPilot().catch((error) => {
  console.error(`[seedPilot] Failed: ${error.message}`);
  process.exitCode = 1;
});
