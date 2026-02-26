require('dotenv').config();
const express = require('express');
const http = require('http');
const morgan = require('morgan');
const WebSocket = require('ws');
const { createWsServer, wsManager } = require('./webSocketManager');

const keysRouter = require('./routes/keys');
const commandsRouter = require('./routes/commands');
const eventsRouter = require('./routes/events');
const devicesRouter = require('./routes/devices');

const app = express();
app.use(morgan('dev'));
app.use(express.json());

// route handlers
app.use('/keys', keysRouter);            // 
app.use('/devices', commandsRouter);     // 
app.use('/devices', devicesRouter);     //
app.use('/events', eventsRouter);   // 

app.get('/', (req, res) => res.send('SmartLock-Backend running'));

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// start WebSocket server and expose send functions
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws, req) => {
  console.log('New websocket connection established');
  wsManager.registerDevice(ws); // Register the new device connection
  
  ws.on('message', (message) => {
    // console.log('Received message from client:', message);
    // Here you can handle messages from the client if needed
  });

});

server.listen(port, () => {
  console.log(`SmartLock-Backend listening on http://localhost:${port}`);
});