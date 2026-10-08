const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getResortInfo,
  getAdminResortInfo,
  updateResortInfo,
} = require('../controllers/resortSettingsController');

const publicRouter = express.Router();
const adminRouter = express.Router();

publicRouter.get('/', getResortInfo);
adminRouter.use(requireAuth, requireRole('admin'));
adminRouter.get('/', getAdminResortInfo);
adminRouter.put('/', updateResortInfo);

module.exports = { publicRouter, adminRouter };
