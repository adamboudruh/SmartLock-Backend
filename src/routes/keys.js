const express = require('express');
const axios = require('axios');
const router = express.Router();
const { wsManager } = require('../webSocketManager'); // ← add this import

const DB_API = process.env.DB_API_URL || 'https://localhost:7110';

const https = require('https');
const agent = new https.Agent({
  rejectUnauthorized: false, // Ignore self-signed certificate issues
});

router.post('/register', async (req, res) => {
  const { name, tagUid } = req.body;
  console.log('Register key', name, tagUid);
  if (!tagUid || !name) return res.status(400).json({ error: 'name and tagUid required' });
  try {
    const resp = await axios.post(`${DB_API}/keys`, { name, tagUid }, { httpsAgent: agent });
    await wsManager.syncWhitelist();
    return res.status(201).json(resp.data);
  } catch (err) {
    console.error('DB-API error', err?.response?.data || err.message);
    return res.status(502).json({ error: 'DB API error' });
  }
});

router.post('/sync', async (req, res) => {
  const ok = await wsManager.syncWhitelist();
  if (!ok) return res.status(503).json({ error: 'Device offline or sync failed' });
  return res.status(200).json({ synced: true });
});

router.get('/', async (req, res) => {
  try {
    const resp = await axios.get(`${DB_API}/keys`, { httpsAgent: agent });
    console.log('Fetched keys', resp.data);
    res.json(resp.data.data);
  } catch (err) {
    console.error('DB-API error', err?.response?.data || err.message);
    res.status(502).json({ error: 'DB API error' });
  }
});

router.get('/test', (req, res) => {
  res.json({ message: 'Keys route test successful' });
});

module.exports = router;