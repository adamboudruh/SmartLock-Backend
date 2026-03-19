const express = require('express');
// const axios = require('axios');
const router = express.Router();
const { wsManager } = require('../webSocketManager'); // ← add this import
const dbAxios = require('../services/dbApiClient').dbAxios;

router.post('/register', async (req, res) => {
  const { name, tagUid, color } = req.body;
  console.log('Register key', name, tagUid, color);
  if (!tagUid || !name) return res.status(400).json({ error: 'name and tagUid required' });
  try {
    const resp = await dbAxios.post('/keys', { name, tagUid, color });
    await wsManager.syncDevice();
    return res.status(201).json(resp.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.statusDetails  // array of strings from DB API
                 || err?.response?.data?.title
                 || err?.message
                 || 'Unknown error';
    
    console.error('[Keys] Error:', err);
    return res.status(status).json({ error: Array.isArray(details) ? details.join(', ') : details });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbAxios.delete(`/keys/${id}`);
    await wsManager.syncDevice(); // resync after deletion
    return res.status(204).json({ deleted: true });
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.statusDetails  // array of strings from DB API
                 || err?.response?.data?.title
                 || err?.message
                 || 'Unknown error';
    
    console.error('[Keys] Error:', details);
    return res.status(status).json({ error: Array.isArray(details) ? details.join(', ') : details });
  }
});

router.post('/sync', async (req, res) => {
  const ok = await wsManager.syncDevice();
  if (!ok) return res.status(503).json({ error: 'Device offline or sync failed' });
  return res.status(200).json({ synced: true });
});

router.get('/', async (req, res) => {
  try {
    const resp = await dbAxios.get('/keys');
    console.log('Fetched keys', resp.data.data);
    res.json(resp.data.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data?.statusDetails  // array of strings from DB API
                 || err?.response?.data?.title
                 || err?.message
                 || 'Unknown error';
    
    console.error('[Keys] Error:', details);
    return res.status(status).json({ error: Array.isArray(details) ? details.join(', ') : details });
  }
});

router.get('/test', (req, res) => {
  res.json({ message: 'Keys route test successful' });
});

module.exports = router;