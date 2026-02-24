const express = require('express');
const { wsManager } = require('../webSocketManager');
const axios = require('axios');
const { EventTypes } = require('../constants/eventTypes');
const router = express.Router();

const DB_API = process.env.DB_API_URL || 'https://localhost:7110';

const https = require('https');
const agent = new https.Agent({
  rejectUnauthorized: false, // Ignore self-signed certificate issues
});

function makeCommand(action) {
  return {
    action,
    commandId: Date.now().toString(16),
    ts: new Date().toISOString()
  };
}

async function logEvent(eventTypeId) {
  try {
    const resp = await axios.post(`${DB_API}/events`, {
      eventTypeId: eventTypeId,
      // deviceId: "" // Replace with appropriate deviceId logic if applicable
    }, { httpsAgent: agent });
    console.log(`Logged event. eventTypeId: ${eventTypeId}`);
    return resp.data;
  } catch (err) {
    console.error('Failed to log event:', err?.response?.data || err.message);
    throw new Error('Failed to log event to DB-API');
  }
}

router.post('/lock', async (req, res) => {
  // const { deviceId } = req.params;
  const cmd = makeCommand('LOCK');
  console.log("Received lock command request");
  const ok = wsManager.sendCommand(cmd);
  if (!ok) return res.status(503).json({ error: 'device offline' });
  await logEvent(EventTypes.RemoteLock); // Log lock event (eventTypeId: 2 for remote lock)
  return res.status(202).json({ accepted: true, commandId: cmd.commandId });
});

router.post('/unlock', async (req, res) => {
  // const { deviceId } = req.params;
  const cmd = makeCommand('UNLOCK');
  console.log("Received unlock command request");
  const ok = wsManager.sendCommand(cmd);
  if (!ok) return res.status(503).json({ error: 'device offline' });
  await logEvent(EventTypes.RemoteUnlock); // Log unlock event (eventTypeId: 4 for remote unlock)
  return res.status(202).json({ accepted: true, commandId: cmd.commandId });
});

// router.post('/sync-whitelist', async (req, res) => {
//   // const { deviceId } = req.params;
//   const cmd = makeCommand('SYNC');
//   console.log("Received sync whitelist command request");
//   const ok = wsManager.sendCommand(cmd);
//   if (!ok) return res.status(503).json({ error: 'device offline' });
//   await logEvent(EventTypes.WhitelistSync); // Log whitelist sync event (eventTypeId: 8 for whitelist sync)
//   return res.status(202).json({ accepted: true, commandId: cmd.commandId });
// });

module.exports = router;