const express = require('express');
const router = express.Router();
const rateController = require('../controllers/rate.controller');
const { authenticate } = require('../middleware/authenticate');

/**
 * @route   GET /api/v1/rates
 * @desc    Get current exchange rates
 * @access  Public
 */
router.get('/', rateController.getRates);

/**
 * @route   GET /api/v1/rates/history
 * @desc    Get historical rates
 * @access  Public
 */
router.get('/history', rateController.getRateHistory);

/**
 * @route   POST /api/v1/rates/calculate
 * @desc    Calculate conversion between currencies
 * @access  Public
 */
router.post('/calculate', rateController.calculateConversion);

/**
 * @route   POST /api/v1/rates/account/generate
 * @desc    Generate virtual account for user
 * @access  Private (requires authentication)
 */
router.post('/account/generate', authenticate, rateController.generateVirtualAccount);

module.exports = router;
