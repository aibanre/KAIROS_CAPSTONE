const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { singleImageUpload } = require('../middleware/upload');
const controller = require('../controllers/adminInventoryController');

const router = express.Router();
router.use(requireAuth);

router.get('/inventory-items', requireRole('admin', 'receptionist'), controller.listInventoryItems);
router.get('/reservations/:id/inventory', requireRole('admin', 'receptionist'), controller.getInventory);
router.post('/reservations/:id/inventory/check-out', requireRole('admin', 'receptionist'), singleImageUpload('signature'), controller.saveInventory);
router.patch('/reservations/:id/inventory/charges/collect', requireRole('admin', 'receptionist'), controller.collectCharges);

module.exports = router;
