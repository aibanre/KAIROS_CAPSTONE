const MANILA_TIME_ZONE = 'Asia/Manila'
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
})

const monthYearFormatter = new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TIME_ZONE,
    month: 'short',
    year: 'numeric',
})

function parseDateOnly(value) {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return null
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const calendarDate = new Date(Date.UTC(year, month - 1, day))
    if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() + 1 !== month || calendarDate.getUTCDate() !== day) return null
    return new Date(Date.UTC(year, month - 1, day, 12))
}

function parseDateTime(value) {
    if (value instanceof Date) return new Date(value.getTime())
    const source = String(value).trim()
    if (!source) return null
    const normalized = source.includes('T') ? source : source.replace(' ', 'T')
    const date = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
        ? new Date(normalized)
        : new Date(`${normalized}+08:00`)
    return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateOnly(value) {
    if (value === null || value === undefined || value === '') return 'N/A'
    const date = typeof value === 'string' && DATE_ONLY_PATTERN.test(value)
        ? parseDateOnly(value)
        : parseDateTime(value)
    return date ? dateFormatter.format(date) : 'N/A'
}

export function formatDateTime(value) {
    if (value === null || value === undefined || value === '') return 'N/A'
    const date = parseDateTime(value)
    return date ? dateTimeFormatter.format(date) : 'N/A'
}

export function formatMonthYear(value) {
    if (value === null || value === undefined || value === '') return 'N/A'
    const date = parseDateTime(value)
    return date ? monthYearFormatter.format(date) : 'N/A'
}

export function formatTime(value) {
    if (!value) return 'N/A'
    const match = String(value).match(/^(\d{1,2}):(\d{2})/)
    if (!match) return 'N/A'
    const date = new Date(`1970-01-01T${String(match[1]).padStart(2, '0')}:${match[2]}:00+08:00`)
    return Number.isNaN(date.getTime())
        ? 'N/A'
        : new Intl.DateTimeFormat('en-PH', { timeZone: MANILA_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(date)
}

export function formatDateRange(start, end) {
    const formattedStart = formatDateOnly(start)
    const formattedEnd = formatDateOnly(end)
    if (formattedStart === 'N/A' && formattedEnd === 'N/A') return 'N/A'
    if (formattedStart === 'N/A') return `Until ${formattedEnd}`
    if (formattedEnd === 'N/A' || formattedStart === formattedEnd) return formattedStart
    return `${formattedStart} - ${formattedEnd}`
}

export function formatVenueDateTime(date, start, end) {
    const formattedDate = formatDateOnly(date)
    if (formattedDate === 'N/A') return 'N/A'
    if (!start && !end) return formattedDate
    return `${formattedDate}, ${formatTime(start)} - ${formatTime(end)}`
}
