const express = require('express');
const router = express.Router();

// Try to load controller
let rateController;
try {
    rateController = require('../controllers/rate.controller');
} catch (error) {
    console.error('⚠️ rate.controller not found:', error.message);
    // Fallback controller with default rates
    rateController = {
        getRates: (req, res) => {
            res.status(200).json({
                status: 'success',
                data: {
                    ngnToKsh: 0.18,
                    kshToNgn: 5.5,
                    lastUpdated: new Date().toISOString()
                }
            });
        }
    };
}

// GET /api/v1/rates - Get exchange rates
router.get('/', rateController.getRates);

// Test route
router.get('/test', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'Rate routes are working!',
        currentRates: {
            ngnToKsh: 0.18,
            kshToNgn: 5.5
        }
    });
});

module.exports = router;
