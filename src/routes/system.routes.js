const express = require('express');
const router = express.Router();
const axios = require('axios');

// Get Railway's outgoing IP address
router.get('/ip', async (req, res) => {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        res.json({
            ip: response.data.ip,
            server: 'Railway',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
