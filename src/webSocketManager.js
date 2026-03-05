const WebSocket = require('ws');
const axios = require('axios');
const { EventTypes } = require('./constants/eventTypes');
const crypto = require('crypto');
const { getDeviceSecret } = require('./services/deviceService');

const DB_API = process.env.DB_API_URL || 'https://localhost:7110';
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function verifyAuth(message) {
  try {
    const parsedMsg = JSON.parse(message);
    const { deviceId, timestamp, hmac } = parsedMsg;

    const age = Date.now() - parseInt(timestamp) * 1000;
    if (age > 3000000) return { valid: false, reason: 'Stale timestamp' };

    const secretBase64 = await getDeviceSecret(deviceId); // Base64 string
    if (!secretBase64) return { valid: false, reason: 'Unknown device' };

    const secretBytes = Buffer.from(secretBase64, 'base64').toString('hex'); // ← decode to raw bytes

    const expected = crypto
      .createHmac('sha256', secretBytes)             // ← use bytes, not the string
      .update(`${deviceId}:${timestamp}`)
      .digest('hex');

    const valid = crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(expected, 'hex')
    );

    return { valid, deviceId };
   } catch (e) {
    return { valid: false, reason: 'Malformed auth message' };
  }
}

async function logEvent(eventTypeId, uid = null) {
  try {
    const resp = await axios.post(`${DB_API}/events`, {
      eventTypeId,
      ...(this.deviceId && { deviceId: this.deviceId }),
      ...(uid && { tagUid: uid }) // ← only include if present
    }, { httpsAgent: agent });
    console.log(`[Event] Logged eventTypeId=${eventTypeId}${uid ? ` uid=${uid}` : ''}`);
    return resp.data;
  } catch (err) {
    console.error('[Event] Failed to log:', err?.response?.data || err.message);
  }
}

// Map ESP32 event strings to EventType IDs
const eventTypeMap = {
  'LOCK':           EventTypes.ButtonLock,
  'UNLOCK_SUCCESS': EventTypes.SuccessKeyUnlock,
  'FAIL_UNLOCK':    EventTypes.FailKeyUnlock,
  'DOOR_OPEN':      EventTypes.Open,
  'DOOR_CLOSED':    EventTypes.Close,
};

class WebSocketManager {
  constructor() {
    this.client = null; // Single WebSocket instance
    this.deviceId = null; // Track the authenticated device ID
    this.isLocked = null; // Track lock state (true for locked, false for unlocked)
    this.isAjar  = null; // Track door ajar state (true for ajar, false for closed)
  }

  // Register a new device with a WebSocket connection
  registerDevice(ws) {
    if (this.client) {
      console.log(`A device is already connected. Replacing old connection.`);
      this.client.close(); // Close existing connection if any
    }

    ws.authenticated = false; // Mark as unauthenticated until verified

    ws.on('message', async (data) => {
      if (!ws.authenticated) {
        const result = await verifyAuth(data.toString());
        if (!result.valid) {
          console.warn(`[Auth] Rejected: ${result.reason}`);
          ws.close(1008, 'Unauthorized');
          return;
        }
        ws.authenticated = true;
        this.client   = ws;
        this.deviceId = result.deviceId;
        console.log(`[Auth] Device authenticated: ${this.deviceId}`);
        ws.send(JSON.stringify({ action: 'AUTH_OK' })); // authenticated
        return; // wait for the next message (INIT) before doing anything else
      }

      try {
        const msg = JSON.parse(data);
        if (msg.event === 'INIT') {
          console.log('[State] Connection initialized, syncing whitelist...');
          this.syncWhitelist();
        } 
        if (msg.event) {
          // Update tracked state
          if (msg.isLocked !== undefined) this.isLocked = msg.isLocked;
          if (msg.isAjar   !== undefined) this.isAjar  = msg.isAjar;
          console.log(`[State] event=${msg.event} \n\tisLocked=${this.isLocked} \n\tisAjar=${this.isAjar} \n\tkeyId=${msg.uid ?? null}`);
          const eventTypeId = eventTypeMap[msg.event];
          if (eventTypeId) {
            logEvent(eventTypeId, msg.uid ?? null);
          }
        } else {
          // Plain text messages like "ESP32 Connected!"
          console.log('[WebSocket] Device message:', data.toString());
        }
      } catch (e) {
        // Not JSON, just log it
        console.log('[WebSocket] Device message:', data.toString());
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (this.client === ws) { // ← only null out if it's still the active client
        this.client   = null;
        this.deviceId = null;
        this.isLocked = null;
        this.isAjar   = null;
      }
    });
  }

  // Send a command to a specific device
  sendCommand(command) {
    const client = this.client;

    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(command)); // Send the command as a JSON string
      console.log(`Command sent:`, command);
      if (command.action === 'LOCK')   this.isLocked = true;
      if (command.action === 'UNLOCK') this.isLocked = false;
      return true;
    } else {
      console.error(`Device is not connected or WebSocket is not open`);
      return false;
    }
  }

  getState() {
    const online = this.client !== null && this.client.readyState === WebSocket.OPEN;
    console.log(`[GetState] isLocked=${this.isLocked} isAjar=${this.isAjar} online=${online}`);
    return {
      isLocked: this.isLocked,
      isAjar:   this.isAjar,
      online
    };
  }

  async syncWhitelist() {
    const maxAttempts = 50; // try 50 times (5 seconds) before giving up
    for (let i = 0; i < maxAttempts; i++) {
        if (this.client && this.client.readyState === WebSocket.OPEN) break;
        await new Promise(r => setTimeout(r, 100));
        if (i === maxAttempts - 1) {
            console.warn('[Sync] Timed out waiting for device to be ready');
            return false;
        }
    }
    try {
        const resp = await axios.get(`${DB_API}/keys`, { httpsAgent: agent });
        const keys = resp.data.data;

        this.client.send(JSON.stringify({
            action: 'SYNC',
            whitelist: keys.map(k => ({ uid: k.tagUid, name: k.name })), // only send what ESP32 needs
            ts: new Date().toISOString()
        }));

        console.log(`[Sync] Whitelist sent to device (${keys.length} keys)`);
        return true;
    } catch (err) {
        // console.error('[Sync] Failed to fetch or send whitelist:', err?.response?.data || err.message);
        return false;
    }
  }
}

const wsManager = new WebSocketManager();
module.exports = { wsManager, logEvent };