import test from 'node:test'
import assert from 'node:assert/strict'
import { getReservationDateRangeBounds, matchesReservationDateRange } from './reservationDateFilters.js'

test('week bounds use Monday through Sunday in Manila calendar time', () => {
    const bounds = getReservationDateRangeBounds('This Week', new Date('2026-10-25T17:00:00.000Z'))
    assert.deepEqual(bounds, { start: '2026-10-26', end: '2026-11-01' })
})

test('month bounds include the full Manila calendar month', () => {
    const bounds = getReservationDateRangeBounds('This Month', new Date('2026-10-26T02:00:00.000Z'))
    assert.deepEqual(bounds, { start: '2026-10-01', end: '2026-10-31' })
})

test('room reservations match when their inclusive stay overlaps the range', () => {
    const bounds = { start: '2026-10-26', end: '2026-11-01' }
    assert.equal(matchesReservationDateRange({ checkInDate: '2026-10-24', checkOutDate: '2026-10-26' }, bounds), true)
    assert.equal(matchesReservationDateRange({ checkInDate: '2026-11-01', checkOutDate: '2026-11-03' }, bounds), true)
    assert.equal(matchesReservationDateRange({ checkInDate: '2026-11-02', checkOutDate: '2026-11-03' }, bounds), false)
})

test('venue reservations match by event date without shifting date-only strings', () => {
    const bounds = { start: '2026-10-26', end: '2026-11-01' }
    assert.equal(matchesReservationDateRange({ isVenue: true, eventDate: '2026-11-01' }, bounds), true)
    assert.equal(matchesReservationDateRange({ isVenue: true, eventDate: '2026-11-02' }, bounds), false)
})

test('Date values are normalized to their Manila calendar date', () => {
    const bounds = { start: '2026-10-26', end: '2026-11-01' }
    assert.equal(matchesReservationDateRange({ isVenue: true, eventDate: new Date('2026-10-25T17:00:00.000Z') }, bounds), true)
})
