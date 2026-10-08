// routes/adminVenueRoutes.js
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { singleImageUpload } = require('../middleware/upload');
const router = express.Router();
const {
  getAllVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deactivateVenue,
  reactivateVenue,
  deleteVenue,
} = require('../controllers/adminVenueController');

router.use(requireAuth, requireRole('admin'));

router.get('/', getAllVenues);
router.get('/:id', getVenueById);
router.post('/', singleImageUpload('images'), createVenue);
router.put('/:id', singleImageUpload('images'), updateVenue);
router.patch('/:id/deactivate', deactivateVenue);
router.patch('/:id/reactivate', reactivateVenue);
router.delete('/:id', deleteVenue);

module.exports = router;