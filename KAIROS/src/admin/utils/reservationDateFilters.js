function toCalendarDate(value) {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return ''
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(value)
        const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, part]))
        return `${values.year}-${values.month}-${values.day}`
    }
    const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})(?:$|[T ])/)
    return match?.[1] || ''
}

function addCalendarDays(date, amount) {
    const [year, month, day] = date.split('-').map(Number)
    const result = new Date(Date.UTC(year, month - 1, day + amount))
    return result.toISOString().slice(0, 10)
}

export function getReservationDateRangeBounds(range, now = new Date()) {
    const today = toCalendarDate(now)
    if (!today) return null

    if (range === 'This Week') {
        const weekday = new Date(`${today}T00:00:00Z`).getUTCDay()
        const mondayOffset = (weekday + 6) % 7
        const start = addCalendarDays(today, -mondayOffset)
        return { start, end: addCalendarDays(start, 6) }
    }

    if (range === 'This Month') {
        const start = `${today.slice(0, 7)}-01`
        const nextMonth = new Date(`${start}T00:00:00Z`)
        nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
        return { start, end: addCalendarDays(nextMonth.toISOString().slice(0, 10), -1) }
    }

    return null
}

export function matchesReservationDateRange(reservation, bounds) {
    if (!bounds) return true

    if (reservation.isVenue) {
        const eventDate = toCalendarDate(reservation.eventDate)
        return Boolean(eventDate && eventDate >= bounds.start && eventDate <= bounds.end)
    }

    const checkIn = toCalendarDate(reservation.checkInDate)
    const checkOut = toCalendarDate(reservation.checkOutDate)
    return Boolean(checkIn && checkOut && checkIn <= bounds.end && checkOut >= bounds.start)
}
