import test from 'node:test'
import assert from 'node:assert/strict'
import { groupRooms, groupVenues } from './groupUnits.js'

test('groups rooms by normalized type, capacity and price while keeping status and date counts distinct', () => {
	const groups = groupRooms([
		{ id: 1, name: '201', type: ' Deluxe ', capacity: '2 Guests', price: 1200, status: 'available' },
		{ id: 2, name: '202', type: 'deluxe', capacity: '2 Guests', price: 1200, status: 'available' },
		{ id: 3, name: '203', type: 'Deluxe', capacity: '2 Guests', price: 1200, status: 'maintenance' },
		{ id: 4, name: '204', type: 'Deluxe', capacity: '3 Guests', price: 1200, status: 'available' },
	])
	const deluxe = groups.find((group) => group.type.trim().toLowerCase() === 'deluxe' && group.capacity.startsWith('2'))

	assert.equal(deluxe.unitCount, 2)
	assert.equal(deluxe.availableUnitCount, 2)
	assert.equal(deluxe.grouped, true)

	const dateLimited = groupRooms([
		{ id: 1, name: '201', type: 'Deluxe', capacity: 2, price: 1200, status: 'available' },
		{ id: 2, name: '202', type: 'Deluxe', capacity: 2, price: 1200, status: 'available' },
	], new Set([2]))[0]
	assert.equal(dateLimited.unitCount, 2)
	assert.equal(dateLimited.availableUnitCount, 1)
})

test('groups numbered day-use venues by base name and leaves plain and packaged venues individual', () => {
	const groups = groupVenues([
		{ id: 1, name: 'Small Cottage 2', type: 'Cottage', capacity: 4, booking_mode: 'day_use', flat_price: 800, status: 'available' },
		{ id: 2, name: 'Small Cottage #1', type: ' cottage ', capacity: 4, booking_mode: 'day_use', flat_price: 800, status: 'available' },
		{ id: 3, name: 'Small Cottage', type: 'Cottage', capacity: 4, booking_mode: 'day_use', flat_price: 800, status: 'available' },
		{ id: 4, name: 'Conference Hall 1', type: 'Hall', capacity: 100, booking_mode: 'packaged', status: 'available' },
		{ id: 5, name: 'Conference Hall 2', type: 'Hall', capacity: 100, booking_mode: 'packaged', status: 'available' },
	])

	assert.equal(groups.length, 4)
	assert.equal(groups.find((group) => group.groupName === 'Small Cottage').unitCount, 2)
	assert.equal(groups.filter((group) => group.booking_mode === 'packaged').length, 2)
})
