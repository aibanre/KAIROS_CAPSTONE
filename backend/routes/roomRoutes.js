// routes/roomRoutes.js
const express = require('express');
const router = express.Router();
const {
  listRooms,
  getRoom,
  checkRoomAvailability,
  checkSingleRoomAvailability,
  getBookedDatesForMonth,
} = require('../controllers/roomController');

// GET /api/rooms
router.get('/', listRooms);

// GET /api/rooms/availability?check_in=2026-09-10&check_out=2026-09-12
router.get('/availability', checkRoomAvailability);

// GET /api/rooms/:id
router.get('/:id', getRoom);

// GET /api/rooms/:id/booked-dates?year=2026&month=9
router.get('/:id/booked-dates', getBookedDatesForMonth);

// GET /api/rooms/5/availability?check_in=2026-09-10&check_out=2026-09-12
router.get('/:id/availability', checkSingleRoomAvailability);

module.exports = router;