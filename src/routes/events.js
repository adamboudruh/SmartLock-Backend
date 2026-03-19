const express = require('express');
// const axios = require('axios');
const router = express.Router();
const dbAxios = require('../services/dbApiClient').dbAxios;

router.get('/', async (req, res) => {
  try {
    const resp = await dbAxios.get('/events');
    return res.json(resp.data.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.statusDetails  // array of strings from DB API
                 || err?.response?.data?.title
                 || err?.message
                 || 'Unknown error';
    
    console.error('[Events] Error:', details);
    return res.status(status).json({ error: Array.isArray(details) ? details.join(', ') : details });
  }
});

router.delete('/', async (req, res) => {
  try {
    await dbAxios.delete('/events');
    return res.status(200).json({ cleared: true });
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.statusDetails  // array of strings from DB API
                 || err?.response?.data?.title
                 || err?.message
                 || 'Unknown error';
    
    console.error('[Events] Error:', details);
    return res.status(status).json({ error: Array.isArray(details) ? details.join(', ') : details });
  }
});

module.exports = router;