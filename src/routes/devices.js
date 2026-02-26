const express = require('express');
const router = express.Router();
const { wsManager } = require('../webSocketManager');

// GET /devices/state
router.get('/state', (req, res) => {
  const state = wsManager.getState();
  return res.status(200).json(state);
});

module.exports = router;