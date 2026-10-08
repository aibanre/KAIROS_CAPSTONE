const express = require('express');
const { getActivePaymentMethods } = require('../controllers/paymentMethodController');

const router = express.Router();

// GET /api/payment-methods
router.get('/', getActivePaymentMethods);

module.exports = router;
