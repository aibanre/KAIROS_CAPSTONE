function normalizedText(value) {
  return String(value ?? '').trim().toLocaleLowerCase('en-US');
}

function numericKey(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(value ?? '');
}

function moneyKey(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : String(value ?? '');
}

function compareRoomNumber(left, right) {
  return String(left.room_number ?? '').localeCompare(String(right.room_number ?? ''), 'en', {
    numeric: true,
    sensitivity: 'base',
  }) || Number(left.room_id) - Number(right.room_id);
}

function roomGroupKey(room) {
  return JSON.stringify([
    normalizedText(room.room_type ?? room.type),
    numericKey(room.capacity),
    moneyKey(room.price_per_night ?? room.price),
  ]);
}

function venueNameParts(venue) {
  const name = String(venue.venue_name ?? venue.name ?? '').trim();
  const match = name.match(/^(.*?)\s*#?\s*\d+\s*$/);
  const baseName = match?.[1]?.trim();
  return baseName ? { name, baseName, numbered: true } : { name, baseName: name, numbered: false };
}

function venueGroupKey(venue) {
  const { name, baseName, numbered } = venueNameParts(venue);
  const mode = venue.booking_mode ?? 'day_use';
  if (mode !== 'day_use' || !numbered) return `single:${venue.venue_id ?? venue.id}`;
  return JSON.stringify([
    normalizedText(venue.venue_type ?? venue.type),
    normalizedText(baseName),
    numericKey(venue.capacity),
    mode,
    moneyKey(venue.flat_price),
    venue.start_time ?? null,
    venue.end_time ?? null,
    venue.earliest_start ?? null,
    venue.latest_end ?? null,
    numericKey(venue.slot_step_minutes),
    numericKey(venue.buffer_minutes),
  ]);
}

function sortedRooms(rooms) {
  return [...rooms].sort(compareRoomNumber);
}

function sortedVenues(venues) {
  return [...venues].sort((left, right) => Number(left.venue_id ?? left.id) - Number(right.venue_id ?? right.id));
}

function groupResources(resources, keyFor, sortUnits, isAvailable, groupLabel) {
  const buckets = new Map();
  for (const resource of resources) {
    const key = keyFor(resource);
    const group = buckets.get(key) ?? [];
    group.push(resource);
    buckets.set(key, group);
  }

  return [...buckets.values()].map((units) => {
    const sortedUnits = sortUnits(units);
    const availableUnits = sortedUnits.filter(isAvailable);
    const representative = availableUnits[0] ?? sortedUnits[0];
    return {
      ...representative,
      groupName: groupLabel(representative),
      unitCount: availableUnits.length,
      availableUnitCount: availableUnits.length,
      grouped: sortedUnits.length > 1,
      groupUnits: sortedUnits,
    };
  });
}

function groupRooms(rooms) {
  return groupResources(
    rooms,
    roomGroupKey,
    sortedRooms,
    (room) => normalizedText(room.status) === 'available',
    (room) => String(room.room_type ?? room.type ?? '').trim(),
  );
}

function groupVenues(venues) {
  return groupResources(
    venues,
    venueGroupKey,
    sortedVenues,
    (venue) => normalizedText(venue.status) === 'available',
    (venue) => venueNameParts(venue).baseName,
  );
}

async function getRoomGroup(executor, roomId, { forUpdate = false } = {}) {
  const [[representative]] = await executor.query('SELECT * FROM Rooms WHERE room_id = ?', [roomId]);
  if (!representative) return null;
  const [rows] = await executor.query(
    `SELECT * FROM Rooms
     WHERE LOWER(TRIM(room_type)) = ? AND capacity = ? AND price_per_night = ?
     ORDER BY room_number, room_id${forUpdate ? ' FOR UPDATE' : ''}`,
    [
      normalizedText(representative.room_type),
      representative.capacity,
      representative.price_per_night,
    ],
  );
  const group = groupRooms(rows).find((item) => item.groupUnits.some((room) => Number(room.room_id) === Number(roomId)));
  return group ?? { ...representative, groupUnits: [representative], grouped: false };
}

async function getVenueGroup(executor, venueId, { forUpdate = false } = {}) {
  const [[representative]] = await executor.query('SELECT * FROM Venues WHERE venue_id = ?', [venueId]);
  if (!representative) return null;
  if (representative.booking_mode !== 'day_use') {
    if (forUpdate) {
      const [[lockedRepresentative]] = await executor.query(
        'SELECT * FROM Venues WHERE venue_id = ? FOR UPDATE',
        [venueId],
      );
      return lockedRepresentative ? { ...lockedRepresentative, groupUnits: [lockedRepresentative], grouped: false } : null;
    }
    return { ...representative, groupUnits: [representative], grouped: false };
  }
  const [candidates] = await executor.query(
    `SELECT * FROM Venues
     WHERE LOWER(TRIM(venue_type)) = ? AND capacity = ? AND booking_mode = 'day_use'
     ORDER BY venue_id`,
    [normalizedText(representative.venue_type), representative.capacity],
  );
  const candidateGroup = groupVenues(candidates).find((item) => item.groupUnits.some((venue) => Number(venue.venue_id) === Number(venueId)));
  if (!candidateGroup) return { ...representative, groupUnits: [representative], grouped: false };
  if (!forUpdate) return candidateGroup;
  const ids = candidateGroup.groupUnits.map((venue) => venue.venue_id);
  const [lockedRows] = await executor.query(
    `SELECT * FROM Venues WHERE venue_id IN (${ids.map(() => '?').join(',')}) ORDER BY venue_id FOR UPDATE`,
    ids,
  );
  const group = groupVenues(lockedRows).find((item) => item.groupUnits.some((venue) => Number(venue.venue_id) === Number(venueId)));
  return group ?? { ...representative, groupUnits: [representative], grouped: false };
}

module.exports = {
  groupRooms,
  groupVenues,
  getRoomGroup,
  getVenueGroup,
  roomGroupKey,
  venueGroupKey,
  venueNameParts,
};
