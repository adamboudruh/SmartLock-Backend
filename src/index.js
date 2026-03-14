require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
app.use(cors({
  origin: 'http://localhost:5173' // allow Vite dev server
}))

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
  console.log('[WS] New connection:', req.url);
  if (req.url === '/device') {
    wsManager.registerDevice(ws);
  } else if (req.url === '/mobile') {
    wsManager.registerMobile(ws);
  } else {
    console.warn('[WS] Unknown path, closing:', req.url);
    ws.close(1008, 'Unknown endpoint');
  }
});

server.listen(port, () => {
  console.log(`SmartLock-Backend listening on http://localhost:${port}`);
});