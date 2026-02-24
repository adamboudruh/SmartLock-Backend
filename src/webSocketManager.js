const WebSocket = require('ws');

class WebSocketManager {
  constructor() {
    this.client = null; // Single WebSocket instance
  }

  // Register a new device with a WebSocket connection
  registerDevice(ws) {
    if (this.client) {
      console.log(`A device is already connected. Replacing old connection.`);
      this.client.close(); // Close existing connection if any
    }

    this.client = ws; // Store the WebSocket in the map
    console.log(`Device connected.`);

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
      return true;
    } else {
      console.error(`Device is not connected or WebSocket is not open`);
      return false;
    }
  }
}

const wsManager = new WebSocketManager();
module.exports = { wsManager };