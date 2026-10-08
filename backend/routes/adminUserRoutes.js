const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getAllUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
} = require('../controllers/adminUserController');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/deactivate', deactivateUser);
router.patch('/:id/reactivate', reactivateUser);

module.exports = router;