export function addDays(key, n) {
	const [year, month, day] = key.split('-').map(Number)
	const date = new Date(Date.UTC(year, month - 1, day))
	date.setUTCDate(date.getUTCDate() + n)
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function manilaToday(date = new Date()) {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Manila',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date)
	const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]))
	return `${values.year}-${values.month}-${values.day}`
}

export function earliestBookableDate(date = new Date()) {
	return addDays(manilaToday(date), 1)
}

export function rangeHasBooked(checkIn, checkOut, bookedSet) {
	if (!checkIn || !checkOut || checkOut <= checkIn) return false
	for (let date = checkIn; date < checkOut; date = addDays(date, 1)) {
		if (bookedSet.has(date)) return true
	}
	return false
}

export function selectRangeDate(dateKey, checkIn, checkOut) {
	if (!checkIn || checkOut) return [dateKey, '']
	if (dateKey <= checkIn) return [dateKey, '']
	return [checkIn, dateKey]
}

export function isValidDateKey(value) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value || '')
}
