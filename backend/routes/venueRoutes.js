const express = require('express');
const { listVenues, getVenue, getBookedDates, getPackages, getAvailability, quote } = require('../controllers/venueController');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

router.get('/', listVenues);
router.get('/:id/booked-dates', optionalAuth, getBookedDates);
router.get('/:id/packages', getPackages);
router.get('/:id/availability', optionalAuth, getAvailability);
router.get('/:id/quote', optionalAuth, quote);
router.get('/:id', getVenue);

module.exports = router;