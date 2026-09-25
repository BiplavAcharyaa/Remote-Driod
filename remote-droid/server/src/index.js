require('dotenv').config();

const http = require('http');
const express = require('express');
const path = require('path');
const { attachWebSocketServer } = require('./wsServer');
const { log } = require('./logger');

const PORT = parseInt(process.env.PORT || '8080', 10);
const PAIRING_CODE_TTL_MS = parseInt(process.env.PAIRING_CODE_TTL_MS || '300000', 10);
const SESSION_IDLE_TIMEOUT_MS = parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || '1800000', 10);
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '15000', 10);
const HEARTBEAT_MAX_MISSES = parseInt(process.env.HEARTBEAT_MAX_MISSES || '2', 10);

const app = express();

app.use(express.json());

// Simple health check — useful for confirming the server is reachable from
// the phone's network before attempting to pair.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Optionally serve the built React browser client as static files if the
// operator copies its production build into server/public. Not required —
// the browser client can equally be run with its own dev server (see
// browser/README or the top-level README) pointing at this server's
// WebSocket endpoint instead.
app.use(express.static(path.join(__dirname, '..', 'public')));

const server = http.createServer(app);

const { wss, sessionManager } = attachWebSocketServer(server, {
  pairingTtlMs: PAIRING_CODE_TTL_MS,
  sessionIdleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  heartbeatMaxMisses: HEARTBEAT_MAX_MISSES,
});

server.listen(PORT, () => {
  log.info(`Remote Droid signaling server listening on port ${PORT}`);
  log.info(`WebSocket endpoint: ws://<this-machine-ip>:${PORT}`);
  log.info('This server relays signaling/control messages only — no video ever passes through it.');
});

process.on('SIGINT', () => {
  log.info('Shutting down...');
  wss.clients.forEach((c) => c.close());
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGTERM', () => {
  wss.clients.forEach((c) => c.close());
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
});
