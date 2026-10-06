const BOOKING_REFERENCE_PATTERN = /^KAB-\d{4}-\d{2}-\d{4}$/

export default function parseReservationQr(text) {
    const value = String(text ?? '').trim()
    if (!value) return null

    const directReference = value.toUpperCase()
    if (BOOKING_REFERENCE_PATTERN.test(directReference)) return directReference

    try {
        const url = new URL(value)
        if (!['http:', 'https:'].includes(url.protocol)) return null
        const reference = url.searchParams.get('ref')?.trim().toUpperCase()
        return BOOKING_REFERENCE_PATTERN.test(reference || '') ? reference : null
    } catch {
        return null
    }
}
