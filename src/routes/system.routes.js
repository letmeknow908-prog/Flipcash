const express = require('express');
const router = express.Router();
const axios = require('axios');

console.log('✅ System routes loading...');

// Get Railway's outgoing IP address
router.get('/ip', async (req, res) => {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        res.json({
            status: 'success',
            ip: response.data.ip,
            server: 'Railway',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            message: error.message 
        });
    }
});

// Health check for system
router.get('/health', (req, res) => {
    res.json({
        status: 'success',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

console.log('✅ System routes loaded');
module.exports = router;
