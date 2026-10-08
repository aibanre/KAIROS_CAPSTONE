// routes/adminCustomerRoutes.js
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getAllCustomers,
  getCustomerById,
  deactivateCustomer,
  reactivateCustomer,
} = require('../controllers/adminCustomerController');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', getAllCustomers);
router.get('/:id', getCustomerById);
router.patch('/:id/deactivate', deactivateCustomer);
router.patch('/:id/reactivate', reactivateCustomer);

module.exports = router;