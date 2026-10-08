// routes/adminPaymentMethodRoutes.js
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { singleImageUpload } = require('../middleware/upload');
const {
  getAllPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deactivatePaymentMethod,
  reactivatePaymentMethod,
} = require('../controllers/adminPaymentMethodController');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', getAllPaymentMethods);
router.post('/', singleImageUpload, createPaymentMethod);
router.put('/:id', singleImageUpload, updatePaymentMethod);
router.patch('/:id/deactivate', deactivatePaymentMethod);
router.patch('/:id/reactivate', reactivatePaymentMethod);

module.exports = router;