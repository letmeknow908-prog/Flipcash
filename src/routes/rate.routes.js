// src/routes/rate.routes.js
const express = require('express');
const router = express.Router();
const rateController = require('../controllers/rate.controller');

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
 * @access  Private (TODO: add authentication)
 */
router.post('/account/generate', rateController.generateVirtualAccount);

module.exports = router;
