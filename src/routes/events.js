const express = require('express');
const axios = require('axios');
const router = express.Router();

const DB_API = process.env.DB_API_URL || 'https://localhost:7110';

const https = require('https');
const agent = new https.Agent({
  rejectUnauthorized: false,
});

router.get('/', async (req, res) => {
  try {
    const resp = await axios.get(`${DB_API}/events`, { httpsAgent: agent });
    return res.json(resp.data);
  } catch (err) {
    console.error('DB-API error', err?.response?.data || err.message);
    return res.status(502).json({ error: 'DB API error' });
  }
});

router.delete('/', async (req, res) => {
  try {
    await axios.delete(`${DB_API}/events`, { httpsAgent: agent });
    return res.status(200).json({ cleared: true });
  } catch (err) {
    console.error('DB-API error', err?.response?.data || err.message);
    return res.status(502).json({ error: 'DB API error' });
  }
});

module.exports = router;