require('dotenv').config();
const express = require('express');
const http = require('http');
const morgan = require('morgan');
const WebSocket = require('ws');
const { createWsServer, wsManager } = require('./webSocketManager');

const keysRouter = require('./routes/keys');
const commandsRouter = require('./routes/commands');

const app = express();
app.use(morgan('dev'));
app.use(express.json());

// route handlers
app.use('/keys', keysRouter);            // POST /keys/register, GET /keys
app.use('/devices', commandsRouter);     // POST /devices/:id/lock, /unlock

app.get('/', (req, res) => res.send('SmartLock-Backend running'));

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// start WebSocket server and expose send functions
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws, req) => {
  console.log('New websocket connection established');
  wsManager.registerDevice(ws); // Register the new device connection
  
  ws.on('message', (message) => {
    console.log('Received message from client:', message);
    // Here you can handle messages from the client if needed
  });

});

server.listen(port, () => {
  console.log(`SmartLock-Backend listening on http://localhost:${port}`);
});