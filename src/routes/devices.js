const express = require('express');
const router = express.Router();
const { wsManager } = require('../webSocketManager');
const dbAxios = require('../services/dbApiClient').dbAxios;

// GET /devices/state
router.get('/state', (req, res) => {
  const state = wsManager.getState();
  return res.status(200).json(state);
});

// GET /devices/settings
router.get('/settings', async (req, res) => {
    try {
        const deviceId = process.env.DEVICE_ID || 'e3710331-5dcf-464e-9c6f-2d70f9fc277f'; // single-device for now
        const response = await dbAxios.get(`/devices/${deviceId}/settings`);
        res.json(response.data.data);
    } catch (err) {
        console.error('[Settings] GET failed:', err?.response?.data || err.message);
        res.status(err?.response?.status || 500).json({ error: 'Failed to fetch settings' });
    }
});

// PUT /devices/settings
router.put('/settings', async (req, res) => {
    try {
        const deviceId = process.env.DEVICE_ID || 'e3710331-5dcf-464e-9c6f-2d70f9fc277f'; // single-device for now
        const response = await dbAxios.put(`/devices/${deviceId}/settings`, req.body);
        
        // After saving, sync to device
        await wsManager.syncDevice();

        res.json(response.data.data);
    } catch (err) {
        const status = err?.response?.status || 500;
        const details = err?.response?.data?.statusDetails  // array of strings from DB API
                    || err?.response?.data?.title
                    || err?.message
                    || 'Unknown error';
        
        console.error('[Devices] Error:', details);
        return res.status(status).json({ error: Array.isArray(details) ? details.join(', ') : details });
    }
});

module.exports = router;