const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { listImages } = require('../controllers/adminImageController');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));
router.get('/', listImages);

module.exports = router;
