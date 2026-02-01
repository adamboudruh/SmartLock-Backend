const express = require('express');
const { wsManager } = require('../wsManager');
const router = express.Router();

function makeCommand(action) {
  return {
    type: 'command',
    commandId: `cmd-${Date.now()}`,
    action,
    ts: new Date().toISOString()
  };
}

router.post('/:deviceId/lock', async (req, res) => {
  const { deviceId } = req.params;
  const cmd = makeCommand('LOCK');
//   const ok = wsManager.sendCommand(deviceId, cmd);
//   if (!ok) return res.status(503).json({ error: 'device offline' });
//   return res.status(202).json({ accepted: true, commandId: cmd.commandId });
});

router.post('/:deviceId/unlock', async (req, res) => {
  const { deviceId } = req.params;
  const cmd = makeCommand('UNLOCK');
//   const ok = wsManager.sendCommand(deviceId, cmd);
//   if (!ok) return res.status(503).json({ error: 'device offline' });
//   return res.status(202).json({ accepted: true, commandId: cmd.commandId });
});

module.exports = router;