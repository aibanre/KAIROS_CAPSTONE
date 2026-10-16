const test = require('node:test');
const assert = require('node:assert/strict');
const { groupRooms, groupVenues } = require('./resourceGroups');

test('groups rooms by normalized type, capacity and nightly price and counts only available units', () => {
  const groups = groupRooms([
    { room_id: 5, room_number: '201', room_type: ' Deluxe ', capacity: 2, price_per_night: '1200.00', status: 'available' },
    { room_id: 6, room_number: '202', room_type: 'deluxe', capacity: 2, price_per_night: '1200', status: 'maintenance' },
    { room_id: 7, room_number: '203', room_type: 'DELUXE', capacity: 3, price_per_night: '1200', status: 'available' },
    { room_id: 8, room_number: '204', room_type: 'Deluxe', capacity: 2, price_per_night: '1300', status: 'available' },
  ]);

  assert.equal(groups.length, 3);
  const group = groups.find((item) => item.room_id === 5);
  assert.equal(group.unitCount, 1);
  assert.equal(group.grouped, true);
  assert.equal(group.groupUnits[0].room_number, '201');
});

test('groups numbered day-use venues by base name and booking fields but keeps plain and packaged venues separate', () => {
  const groups = groupVenues([
    { venue_id: 1, venue_name: 'Small Cottage 2', venue_type: 'Cottage', capacity: 4, booking_mode: 'day_use', flat_price: '800.00', start_time: '08:00', end_time: '17:00', slot_step_minutes: 30, buffer_minutes: 0, status: 'available' },
    { venue_id: 2, venue_name: 'Small Cottage #1', venue_type: ' cottage ', capacity: 4, booking_mode: 'day_use', flat_price: 800, start_time: '08:00', end_time: '17:00', slot_step_minutes: 30, buffer_minutes: 0, status: 'available' },
    { venue_id: 3, venue_name: 'Small Cottage', venue_type: 'Cottage', capacity: 4, booking_mode: 'day_use', flat_price: 800, start_time: '08:00', end_time: '17:00', slot_step_minutes: 30, buffer_minutes: 0, status: 'available' },
    { venue_id: 4, venue_name: 'Conference Hall 1', venue_type: 'Hall', capacity: 100, booking_mode: 'packaged', status: 'available' },
    { venue_id: 5, venue_name: 'Conference Hall 2', venue_type: 'Hall', capacity: 100, booking_mode: 'packaged', status: 'available' },
  ]);

  assert.equal(groups.length, 4);
  const cottages = groups.find((item) => item.groupName === 'Small Cottage');
  assert.equal(cottages.unitCount, 2);
  assert.equal(cottages.grouped, true);
  assert.equal(groups.filter((item) => item.booking_mode === 'packaged').length, 2);
});
