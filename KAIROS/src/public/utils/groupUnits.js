function normalizedText(value) {
	return String(value ?? '').trim().toLocaleLowerCase('en-US')
}

function numericKey(value) {
	const number = Number(value)
	return Number.isFinite(number) ? String(number) : String(value ?? '')
}

function moneyKey(value) {
	const number = Number(value)
	return Number.isFinite(number) ? number.toFixed(2) : String(value ?? '')
}

function capacityValue(value) {
	const number = Number.parseFloat(String(value ?? ''))
	return Number.isFinite(number) ? number : value
}

function compareRoomNumber(left, right) {
	return String(left.room_number ?? left.name ?? '').localeCompare(String(right.room_number ?? right.name ?? ''), 'en', {
		numeric: true,
		sensitivity: 'base',
	}) || Number(left.room_id ?? left.id) - Number(right.room_id ?? right.id)
}

function roomGroupKey(room) {
	return JSON.stringify([
		normalizedText(room.room_type ?? room.type),
		numericKey(capacityValue(room.capacity)),
		moneyKey(room.price_per_night ?? room.price),
	])
}

function venueNameParts(venue) {
	const name = String(venue.venue_name ?? venue.name ?? '').trim()
	const match = name.match(/^(.*?)\s*#?\s*\d+\s*$/)
	const baseName = match?.[1]?.trim()
	return baseName ? { name, baseName, numbered: true } : { name, baseName: name, numbered: false }
}

function venueGroupKey(venue) {
	const { name, baseName, numbered } = venueNameParts(venue)
	const mode = venue.booking_mode ?? 'day_use'
	if (mode !== 'day_use' || !numbered) return `single:${venue.venue_id ?? venue.id}`
	return JSON.stringify([
		normalizedText(venue.venue_type ?? venue.type),
		normalizedText(baseName),
		numericKey(capacityValue(venue.capacity)),
		mode,
		moneyKey(venue.flat_price),
		venue.start_time ?? null,
		venue.end_time ?? null,
		venue.earliest_start ?? null,
		venue.latest_end ?? null,
		numericKey(venue.slot_step_minutes),
		numericKey(venue.buffer_minutes),
	])
}

function groupResources(resources, keyFor, sortUnits, isAvailable, groupLabel, availableIds) {
	const buckets = new Map()
	for (const resource of resources) {
		const key = keyFor(resource)
		const group = buckets.get(key) ?? []
		group.push(resource)
		buckets.set(key, group)
	}

	return [...buckets.values()].map((units) => {
		const sortedUnits = [...units].sort(sortUnits)
		const availableUnits = sortedUnits.filter((unit) => isAvailable(unit)
			&& (!availableIds || availableIds.has(Number(unit.room_id ?? unit.venue_id ?? unit.id))))
		const representative = sortedUnits.find(isAvailable) ?? sortedUnits[0]
		const groupName = groupLabel(representative)
		const unitCount = sortedUnits.filter(isAvailable).length
		const availableUnitCount = availableIds ? availableUnits.length : unitCount
		return {
			...representative,
			groupName,
			unitCount,
			availableUnitCount,
			grouped: sortedUnits.length > 1,
			groupSize: sortedUnits.length,
			unitLabel: groupName ? `${unitCount} ${pluralizeVenueUnit(groupName, unitCount)}` : `${unitCount} rooms`,
		}
	})
}

function pluralizeVenueUnit(name, count) {
	const lastWord = name.split(/\s+/).filter(Boolean).at(-1) || 'venue'
	if (count === 1) return lastWord.toLocaleLowerCase('en-US')
	if (/[^aeiou]y$/i.test(lastWord)) return `${lastWord.slice(0, -1).toLocaleLowerCase('en-US')}ies`
	return `${lastWord.toLocaleLowerCase('en-US')}s`
}

export function groupRooms(rooms, availableRoomIds = null) {
	const ids = availableRoomIds ? new Set(Array.from(availableRoomIds, Number)) : null
	return groupResources(
		rooms,
		roomGroupKey,
		(left, right) => compareRoomNumber(left, right),
		(room) => normalizedText(room.status) === 'available',
		(room) => String(room.room_type ?? room.type ?? '').trim(),
		ids,
	).map((group) => ({ ...group, unitLabel: `${group.unitCount} ${group.unitCount === 1 ? 'room' : 'rooms'}` }))
}

export function groupVenues(venues) {
	return groupResources(
		venues,
		venueGroupKey,
		(left, right) => Number(left.venue_id ?? left.id) - Number(right.venue_id ?? right.id),
		(venue) => normalizedText(venue.status) === 'available',
		(venue) => venueNameParts(venue).baseName,
	)
}
