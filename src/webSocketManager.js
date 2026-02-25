const WebSocket = require('ws');
const axios = require('axios');
const { EventTypes } = require('./constants/eventTypes');

const DB_API = process.env.DB_API_URL || 'https://localhost:7110';
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function logEvent(eventTypeId, uid = null) {
  try {
    const resp = await axios.post(`${DB_API}/events`, {
      eventTypeId,
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
    this.isLocked = null; // Track lock state (true for locked, false for unlocked)
    this.isAjar  = null; // Track door ajar state (true for ajar, false for closed)
  }

  // Register a new device with a WebSocket connection
  registerDevice(ws) {
    if (this.client) {
      console.log(`A device is already connected. Replacing old connection.`);
      this.client.close(); // Close existing connection if any
    }

    this.client = ws; // Store the WebSocket in the map
    console.log(`Device connected.`);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
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
          // console.log('[WebSocket] Device message:', data.toString());
        }
      } catch (e) {
        // Not JSON, just log it
        // console.log('[WebSocket] Device message:', data.toString());
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      this.client = null;
    });
  }

  // Send a command to a specific device
  sendCommand(command) {
    const client = this.client;

    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(command)); // Send the command as a JSON string
      console.log(`Command sent:`, command);
      command.action == 'LOCK' ? this.isLocked = true : this.isLocked = false; // Update lock state immediately
      return true;
    } else {
      console.error(`Device is not connected or WebSocket is not open`);
      return false;
    }
  }

  getState() {
    console.log(`[GetState] isLocked=${this.isLocked} isAjar=${this.isAjar} online=${this.client !== null}`);
    return {
      isLocked: this.isLocked,
      isAjar:  this.isAjar,
      online:    this.client !== null
    };
  }
}

const wsManager = new WebSocketManager();
module.exports = { wsManager, logEvent };