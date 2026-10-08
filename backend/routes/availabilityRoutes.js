// routes/availabilityRoutes.js
const express = require('express');
const router = express.Router();
const { getResortWideBookedDates } = require('../controllers/roomController');

// GET /api/availability/booked-dates?year=2026&month=9
router.get('/booked-dates', getResortWideBookedDates);

module.exports = router;