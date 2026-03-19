const WebSocket = require('ws');
// const axios = require('axios');
const { EventTypes } = require('./constants/eventTypes');
const crypto = require('crypto');
const { getDeviceSecret } = require('./services/deviceService');
const { toLocalISO } = require('./utils/timezone');
const dbAxios = require('./services/dbApiClient').dbAxios;

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

async function logEvent(eventTypeId, uid = null, deviceId = null, localTs) {
  try {
    console.log(`[Event] Logging eventTypeId=${eventTypeId}${uid ? ` uid=${uid}` : ''}${deviceId ? ` deviceId=${deviceId}` : ''}${localTs ? ` localTs=${localTs}` : ''}`);
    const payload = {
      eventTypeId,
      ...(deviceId && { deviceId }),
      ...(uid && { tagUid: uid }),
      createdAt: localTs // use the tz adjusted timestamp from the device
    };
    console.log('[Event] Payload:', payload);
    const resp = await dbAxios.post('/events', payload);
    console.log(`[Event] Logged eventTypeId=${eventTypeId}${uid ? ` uid=${uid}` : ''}`);
    return resp.data;
  } catch (err) {
    console.error('[Event] Failed to log:', err?.response?.data || err.message);
  }
}

// Map ESP32 event strings to EventType IDs
const eventTypeMap = {
  'BUTTON_LOCK':    EventTypes.ButtonLock,
  'BUTTON_UNLOCK':  EventTypes.ButtonUnlock,
  'AUTO_LOCK':      EventTypes.AutoLock,
  'UNLOCK_SUCCESS': EventTypes.SuccessKeyUnlock,
  'FAIL_UNLOCK':    EventTypes.FailKeyUnlock,
  'DOOR_OPEN':      EventTypes.Open,
  'DOOR_CLOSED':    EventTypes.Close,
};

class WebSocketManager {
  constructor() {
    this.device = null; // ESP32 connection
    this.mobile = null; // Mobile app connection
    this.deviceId = null; // Track the authenticated device ID
    this.isLocked = null; // Track lock state (true for locked, false for unlocked)
    this.isAjar  = null; // Track door ajar state (true for ajar, false for closed)
  }

  registerConnection(ws, type) {
    if (type === 'device') this.registerDevice(ws);
    else if (type === 'mobile') this.registerMobile(ws);
  }

  pushStateToMobile() {
    if (this.mobile && this.mobile.readyState === WebSocket.OPEN) {
      this.mobile.send(JSON.stringify({ action: 'STATE_UPDATE', ...this.getState() }));
    }
  }

  registerMobile(ws) {
    if (this.mobile) {
      console.log('[Mobile] Replacing existing mobile connection');
      this.mobile.close();
    }
    this.mobile = ws;
    ws.authenticated = true; // just for now

    ws.on('message', async (data) => {
      if (!ws.authenticated) {
        const result = await verifyMobileAuth(data.toString());
        if (!result.valid) {
          console.warn(`[Mobile] Auth rejected: ${result.reason}`);
          ws.close(1008, 'Unauthorized');
          return;
        }
        ws.authenticated = true;
        this.mobile = ws;
        console.log('[Mobile] App authenticated');
        ws.send(JSON.stringify({ action: 'AUTH_OK' }));
        return;
      }

      try {
        const msg = JSON.parse(data.toString());
        console.log('[Mobile] Message:', msg);

        if (msg.action === 'GET_STATE') {
          ws.send(JSON.stringify({ action: 'STATE', ...this.getState() }));
        } else if (msg.action === 'LOCK' || msg.action === 'UNLOCK') {
          const sent = this.sendCommand({ action: msg.action });
          if (!sent) ws.send(JSON.stringify({ action: 'ERROR', reason: 'Device offline' }));
        }
      } catch (e) {
        console.error('[Mobile] Failed to handle message:', e.message);
      }
    });

    ws.on('close', () => {
      console.log('[Mobile] Connection closed');
      if (this.mobile === ws) this.mobile = null;
    });
  }

  // Register a new device with a WebSocket connection
  registerDevice(ws) {
    if (this.device) {
      console.log(`A device is already connected. Replacing old connection.`);
      this.device.close(); // Close existing connection if any
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
        this.device   = ws;
        this.deviceId = result.deviceId;
        console.log(`[Auth] Device authenticated: ${this.deviceId}`);
        ws.send(JSON.stringify({ action: 'AUTH_OK' })); // authenticated
        return; // wait for the next message (INIT) before doing anything else
      }

      try {
        const msg = JSON.parse(data);
        const localTs = toLocalISO(msg.ts || new Date().toISOString());
        if (msg.event === 'INIT') {
          console.log('[State] Connection initialized, syncing...');
          this.syncDevice();
        }
        if (msg.event === 'OFFLINE_SYNC') { // occurs after INIT if ESP32 has cached events
          try {
            console.log(`[State] Received OFFLINE_SYNC with ${msg.events?.length || 0} events`);
            const formatted = msg.events.map(e => ({
                eventTypeId: eventTypeMap[e.event],
                deviceId: this.deviceId,
                tagUid: e.uid || null,
                createdAt: toLocalISO(e.ts || new Date().toISOString()) // pass the tz adjusted RTC timestamp
            }))

            await dbAxios.post('/events/bulk', { events: formatted });
            console.log(`[OfflineSync] Bulk insert successful`);

            // tell ESP32 to clear its cache
            ws.send(JSON.stringify({ action: 'SYNC_OK' }));
          } catch (err) {
            console.error('[OfflineSync] Failed to process offline events:', err?.response?.data || err.message);
            return;
          }
        }
        if (msg.event) {
          // Update tracked state
          if (msg.isLocked !== undefined) this.isLocked = msg.isLocked;
          if (msg.isAjar   !== undefined) this.isAjar  = msg.isAjar;
          this.pushStateToMobile(); // push state update to mobile app
          console.log(`[State] event=${msg.event} \n\tisLocked=${this.isLocked} \n\tisAjar=${this.isAjar} \n\tkeyId=${msg.uid ?? null}`);
          const eventTypeId = eventTypeMap[msg.event];
          if (eventTypeId) {
            logEvent(eventTypeId, msg.uid ?? null, this.deviceId, localTs);
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
      if (this.device === ws) { // ← only null out if it's still the active device
        this.device   = null;
        this.deviceId = null;
        this.isLocked = null;
        this.isAjar   = null;
      }
    });
  }

  // Send a command to a specific device
  async sendCommand(command) {
    const device = this.device;

    if (device && device.readyState === WebSocket.OPEN) {
      device.send(JSON.stringify(command)); // Send the command as a JSON string
      console.log(`Command sent:`, command);
      if (command.action === 'LOCK')   this.isLocked = true;
      if (command.action === 'UNLOCK') this.isLocked = false;
      this.pushStateToMobile(); // push state update to mobile app
      const localTs = toLocalISO(new Date().toISOString());
      await logEvent(command.action === 'LOCK' ? EventTypes.RemoteLock : EventTypes.RemoteUnlock, null, this.deviceId, localTs);
      return true;
    } else {
      console.error(`Device is not connected or WebSocket is not open`);
      return false;
    }
  }

  getState() {
    const online = this.device !== null && this.device.readyState === WebSocket.OPEN;
    console.log(`[GetState] isLocked=${this.isLocked} isAjar=${this.isAjar} online=${online}`);
    return {
      isLocked: this.isLocked,
      isAjar:   this.isAjar,
      online
    };
  }

  async syncDevice() {
    if (!this.device || this.device.readyState !== WebSocket.OPEN) {
      console.warn('[Sync] No device connected, skipping');
      return false;
    }
    try {
        const keysResponse = await dbAxios.get('/keys');
        const keys = keysResponse.data.data;

        const deviceId = process.env.DEVICE_ID;
        const settingsResponse = await dbAxios.get(`/devices/${deviceId}/settings`);
        const settings = settingsResponse.data.data;
        console.log('[Sync] Settings payload:', JSON.stringify(settings, null, 2));

        this.device.send(JSON.stringify({
            action: 'SYNC',
            whitelist: keys.map(k => ({ uid: k.tagUid, name: k.name })),
            settings: settings.map(s => ({ id: s.settingId, name: s.name, value: s.value })),
            ts: new Date().toISOString()
        }));

        console.log(`[Sync] Whitelist sent to device (${keys.length} keys)`);
        console.log(`[Sync] Settings sent to device (${settings.length} settings)`);
        return true;
    } catch (err) {
        console.error('[Sync] Failed to fetch or send whitelist:', err?.response?.data || err.message);
        return false;
    }
  }
}

const wsManager = new WebSocketManager();
module.exports = { wsManager, logEvent };