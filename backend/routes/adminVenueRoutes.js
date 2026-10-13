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
  listPackages,
  createPackage,
  updatePackage,
  deactivatePackage,
} = require('../controllers/adminVenueController');

router.use(requireAuth, requireRole('admin'));

router.get('/', getAllVenues);
router.post('/', singleImageUpload('images'), createVenue);
router.get('/:id/packages', listPackages);
router.post('/:id/packages', createPackage);
router.put('/:id/packages/:packageId', updatePackage);
router.patch('/:id/packages/:packageId/deactivate', deactivatePackage);
router.get('/:id', getVenueById);
router.put('/:id', singleImageUpload('images'), updateVenue);
router.patch('/:id/deactivate', deactivateVenue);
router.patch('/:id/reactivate', reactivateVenue);
router.delete('/:id', deleteVenue);

module.exports = router;