const express = require('express');
const { listVenues, getVenue, getBookedDates } = require('../controllers/venueController');

const router = express.Router();

router.get('/', listVenues);
router.get('/:id/booked-dates', getBookedDates);
router.get('/:id', getVenue);

module.exports = router;