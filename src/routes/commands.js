const express = require('express');
const { wsManager, logEvent } = require('../webSocketManager');
const { EventTypes } = require('../constants/eventTypes');
const router = express.Router();

function makeCommand(action) {
  return {
    action,
    commandId: Date.now().toString(16),
    ts: new Date().toISOString()
  };
}

router.post('/lock', async (req, res) => {
  // const { deviceId } = req.params;
  const { isLocked } = wsManager.getState();
  if (isLocked === true) {
      return res.status(409).json({ error: 'Already locked' });
  }

  const cmd = makeCommand('LOCK');
  console.log("Received lock command request");
  const ok = wsManager.sendCommand(cmd);
  if (!ok) return res.status(503).json({ error: 'device offline' });
  await logEvent(EventTypes.RemoteLock); // Log lock event (eventTypeId: 2 for remote lock)
  return res.status(202).json({ accepted: true, commandId: cmd.commandId });
});

router.post('/unlock', async (req, res) => {
  // const { deviceId } = req.params;
  const { isLocked } = wsManager.getState();
  if (isLocked === false) {
      return res.status(409).json({ error: 'Already unlocked' });
  }

  const cmd = makeCommand('UNLOCK');
  console.log("Received unlock command request");
  const ok = wsManager.sendCommand(cmd);
  if (!ok) return res.status(503).json({ error: 'device offline' });
  await logEvent(EventTypes.RemoteUnlock); // Log unlock event (eventTypeId: 4 for remote unlock)
  return res.status(202).json({ accepted: true, commandId: cmd.commandId });
});

module.exports = router;