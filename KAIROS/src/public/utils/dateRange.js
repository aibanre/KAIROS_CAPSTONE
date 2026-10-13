export function addDays(key, n) {
	const [year, month, day] = key.split('-').map(Number)
	const date = new Date(year, month - 1, day)
	date.setDate(date.getDate() + n)
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
