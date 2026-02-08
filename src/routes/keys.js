const express = require('express');
const axios = require('axios');
const router = express.Router();

const DB_API = process.env.DB_API_URL || 'http://localhost:5000';

router.post('/register', async (req, res) => {
  const { name, tagUid } = req.body;
  console.log('Register key', name, tagUid);
  if (!tagUid || !name) return res.status(400).json({ error: 'name and tagUid required' });
  try {
    const resp = await axios.post(`${DB_API}/keys`, { name, tagUid });
    return res.status(201).json(resp.data);
  } catch (err) {
    console.error('DB-API error', err?.response?.data || err.message);
    return res.status(502).json({ error: 'DB API error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const resp = await axios.get(`${DB_API}/keys`);
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