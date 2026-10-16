// routes/adminRoomRoutes.js
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { singleImageUpload } = require('../middleware/upload');
const router = express.Router();
const {
  getAllRooms,
  getRoomById,
  createRoom,
  bulkCreateRooms,
  bulkUpdateRooms,
  updateRoom,
  deactivateRoom,
  reactivateRoom,
  deleteRoom,
} = require('../controllers/adminRoomController');

router.use(requireAuth, requireRole('admin'));

router.post('/bulk', singleImageUpload('images'), bulkCreateRooms);
router.patch('/bulk', bulkUpdateRooms);
router.get('/', getAllRooms);
router.get('/:id', getRoomById);
router.post('/', singleImageUpload('images'), createRoom);
router.put('/:id', singleImageUpload('images'), updateRoom);
router.patch('/:id/deactivate', deactivateRoom);
router.patch('/:id/reactivate', reactivateRoom);
router.delete('/:id', deleteRoom);

module.exports = router;