const WebSocket = require('ws');
const { MessageType } = require('./protocol');
const { SessionManager } = require('./sessionManager');
const { log } = require('./logger');

/**
 * Two kinds of WebSocket peers connect to this server:
 *   - DEVICE sockets: the Remote Droid Android app (one per phone)
 *   - CLIENT sockets: a laptop browser tab viewing/controlling a device
 *
 * This module relays signaling (SDP offer/answer, ICE candidates) and
 * control commands between a paired device/client pair, authenticates the
 * pairing-code handshake, and never touches actual video/media data — that
 * flows peer-to-peer over WebRTC once ICE negotiation completes.
 */
function attachWebSocketServer(server, options = {}) {
  const wss = new WebSocket.Server({ server });
  const sessionManager = new SessionManager({
    pairingTtlMs: options.pairingTtlMs,
    sessionIdleTimeoutMs: options.sessionIdleTimeoutMs,
  });

  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;
  const heartbeatMaxMisses = options.heartbeatMaxMisses ?? 2;

  wss.on('connection', (socket, req) => {
    socket.role = null; // 'device' | 'client', set once identified
    socket.missedHeartbeats = 0;
    socket.isAlive = true;

    socket.on('pong', () => {
      socket.isAlive = true;
      socket.missedHeartbeats = 0;
    });

    socket.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (e) {
        sendJson(socket, { type: MessageType.ERROR, message: 'Invalid JSON' });
        return;
      }
      try {
        handleMessage(socket, msg);
      } catch (e) {
        log.error('Error handling message', e);
        sendJson(socket, { type: MessageType.ERROR, message: e.message || 'Internal error' });
      }
    });

    socket.on('close', () => {
      handleDisconnect(socket);
    });

    socket.on('error', (err) => {
      log.error('Socket error', err);
    });
  });

  function handleMessage(socket, msg) {
    switch (msg.type) {
      case MessageType.REGISTER_DEVICE:
        return handleRegisterDevice(socket, msg);
      case MessageType.PAIR:
        return handlePair(socket, msg);
      case MessageType.OFFER:
        return relayDeviceToClient(socket, { type: MessageType.DEVICE_OFFER, sdp: msg.sdp });
      case MessageType.ANSWER:
        return relayClientToDevice(socket, { type: MessageType.ANSWER, sdp: msg.sdp });
      case MessageType.ICE_CANDIDATE:
        return relayDeviceToClient(socket, {
          type: MessageType.DEVICE_ICE_CANDIDATE,
          candidate: msg.candidate,
          sdpMid: msg.sdpMid,
          sdpMLineIndex: msg.sdpMLineIndex,
        });
      case 'client_ice_candidate':
        return relayClientToDevice(socket, {
          type: MessageType.REMOTE_ICE_CANDIDATE,
          candidate: msg.candidate,
          sdpMid: msg.sdpMid,
          sdpMLineIndex: msg.sdpMLineIndex,
        });
      case MessageType.SCREEN_INFO:
        return handleScreenInfo(socket, msg);
      case MessageType.APP_LIST:
        return relayDeviceToClient(socket, { type: MessageType.DEVICE_APP_LIST, apps: msg.apps });
      case MessageType.CONTROL:
        return relayClientToDevice(socket, { type: MessageType.CONTROL_COMMAND, command: msg.command });
      case MessageType.HEARTBEAT:
        return sendJson(socket, { type: MessageType.PONG });
      case MessageType.DISCONNECT:
        return handleClientDisconnectRequest(socket);
      default:
        log.warn('Unhandled message type:', msg.type);
    }
  }

  // ---- Device registration & authentication --------------------------------

  function handleRegisterDevice(socket, msg) {
    const { deviceId, pairingCode, deviceSecret, deviceName } = msg;
    if (!deviceId || !pairingCode || !deviceSecret) {
      return sendJson(socket, { type: MessageType.ERROR, message: 'Missing registration fields' });
    }

    const device = sessionManager.registerDevice({ deviceId, pairingCode, deviceSecret, deviceName, socket });
    socket.role = 'device';
    socket.deviceId = deviceId;

    log.info(`Device registered: ${deviceId} (${deviceName}), pairing code ${pairingCode}`);
    sendJson(socket, { type: MessageType.REGISTERED, sessionToken: device.sessionToken });

    // If a browser was already paired to this device from a previous
    // connection (e.g. the phone briefly dropped and reconnected), let it
    // know the device is back online so it can re-request an offer.
    if (device.client && device.client.readyState === WebSocket.OPEN) {
      sendJson(socket, { type: MessageType.CLIENT_CONNECTED });
    }
  }

  // ---- Browser pairing -------------------------------------------------------

  function handlePair(socket, msg) {
    const { pairingCode } = msg;
    const device = sessionManager.findByPairingCode(pairingCode);

    if (!device) {
      return sendJson(socket, { type: MessageType.PAIR_FAILED, message: 'Invalid or expired pairing code' });
    }
    if (!device.isOnline()) {
      return sendJson(socket, { type: MessageType.PAIR_FAILED, message: 'Device is not currently online' });
    }

    // Only one active browser client per device at a time. A new successful
    // pairing supersedes any previous one.
    if (device.client && device.client !== socket && device.client.readyState === WebSocket.OPEN) {
      sendJson(device.client, { type: MessageType.SESSION_TERMINATED });
      device.client.close();
    }

    device.client = socket;
    socket.role = 'client';
    socket.deviceId = device.deviceId;

    log.info(`Browser paired to device ${device.deviceId}`);

    sendJson(socket, {
      type: MessageType.PAIRED,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      screenInfo: device.lastScreenInfo,
    });

    // Tell the phone a viewer is connected so it starts MediaProjection capture
    // and creates the WebRTC offer.
    sendJson(device.socket, { type: MessageType.CLIENT_CONNECTED });
  }

  function handleScreenInfo(socket, msg) {
    const device = sessionManager.findByDeviceId(socket.deviceId);
    if (!device) return;
    device.lastScreenInfo = {
      width: msg.width,
      height: msg.height,
      rotation: msg.rotation,
      densityDpi: msg.densityDpi,
    };
    if (device.client && device.client.readyState === WebSocket.OPEN) {
      sendJson(device.client, { type: MessageType.DEVICE_SCREEN_INFO, ...device.lastScreenInfo });
    }
  }

  // ---- Relay helpers -----------------------------------------------------------

  function relayDeviceToClient(socket, payload) {
    if (socket.role !== 'device') return;
    const device = sessionManager.findByDeviceId(socket.deviceId);
    if (!device || !device.client || device.client.readyState !== WebSocket.OPEN) return;
    sendJson(device.client, payload);
  }

  function relayClientToDevice(socket, payload) {
    if (socket.role !== 'client') return;
    const device = sessionManager.findByDeviceId(socket.deviceId);
    if (!device || !device.isOnline()) return;
    sendJson(device.socket, payload);
  }

  function handleClientDisconnectRequest(socket) {
    if (socket.role !== 'client') return;
    const device = sessionManager.findByDeviceId(socket.deviceId);
    if (device) {
      if (device.isOnline()) sendJson(device.socket, { type: MessageType.SESSION_TERMINATED });
      device.client = null;
    }
    socket.close();
  }

  // ---- Disconnect handling & cleanup --------------------------------------------

  function handleDisconnect(socket) {
    if (socket.role === 'device') {
      log.info(`Device disconnected: ${socket.deviceId}`);
      const device = sessionManager.findByDeviceId(socket.deviceId);
      if (device) {
        sessionManager.removeDeviceSocket(socket.deviceId);
        if (device.client && device.client.readyState === WebSocket.OPEN) {
          sendJson(device.client, { type: MessageType.DEVICE_DISCONNECTED });
        }
      }
    } else if (socket.role === 'client') {
      log.info(`Browser client disconnected from device: ${socket.deviceId}`);
      const device = sessionManager.findByDeviceId(socket.deviceId);
      if (device && device.client === socket) {
        device.client = null;
        if (device.isOnline()) {
          sendJson(device.socket, { type: MessageType.CLIENT_DISCONNECTED });
        }
      }
    }
  }

  // ---- Heartbeat / dead connection reaping ------------------------------------

  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (socket.isAlive === false) {
        socket.missedHeartbeats = (socket.missedHeartbeats || 0) + 1;
        if (socket.missedHeartbeats >= heartbeatMaxMisses) {
          log.warn('Terminating unresponsive socket', socket.deviceId || '(unidentified)');
          return socket.terminate();
        }
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, heartbeatIntervalMs);

  wss.on('close', () => clearInterval(heartbeatTimer));

  function sendJson(socket, obj) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(obj));
    }
  }

  return { wss, sessionManager };
}

module.exports = { attachWebSocketServer };
