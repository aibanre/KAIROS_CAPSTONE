const express = require('express');
const { listReviews } = require('../controllers/customerController');
const router = express.Router();
router.get('/', listReviews);
module.exports = router;
