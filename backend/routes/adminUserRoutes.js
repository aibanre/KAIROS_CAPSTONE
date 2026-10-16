const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const {
  getAllUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
} = require('../controllers/adminUserController');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/deactivate', deactivateUser);
router.patch('/:id/reactivate', reactivateUser);
router.patch('/:id/reset-password', rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), resetUserPassword);

module.exports = router;