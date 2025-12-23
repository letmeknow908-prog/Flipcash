const express = require('express');
const router = express.Router();
const ratesController = require('../controllers/rates.controller');
const { authenticate } = require('../middleware/authenticate');

// Public route - get exchange rates
router.get('/rates', ratesController.getRates);

// Protected route - generate virtual account
router.post('/account/generate', authenticate, ratesController.generateVirtualAccount);

module.exports = router;
