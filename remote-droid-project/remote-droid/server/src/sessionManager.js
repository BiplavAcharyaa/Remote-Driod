const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * In-memory session/pairing store. Nothing here is ever written to disk —
 * pairing codes, tokens and device secrets live only in process memory and
 * are discarded when a session ends or the process restarts.
 *
 * A "device" is a phone running the Remote Droid app; a "client" is a
 * browser tab. A Session links exactly one device to at most one active
 * client at a time.
 */
class SessionManager {
  constructor(options = {}) {
    this.pairingTtlMs = options.pairingTtlMs ?? 5 * 60 * 1000;
    this.sessionIdleTimeoutMs = options.sessionIdleTimeoutMs ?? 30 * 60 * 1000;

    /** @type {Map<string, Device>} keyed by deviceId */
    this.devicesById = new Map();
    /** @type {Map<string, Device>} keyed by current pairing code */
    this.devicesByPairingCode = new Map();
    /** @type {Map<string, Device>} keyed by active session token */
    this.devicesByToken = new Map();
  }

  /**
   * Registers (or re-registers, on reconnect) a device with the pairing
   * code + secret it presents. The pairing code is the short-lived,
   * user-visible code shown on the phone screen; the device secret is a
   * long-lived per-install value used to re-authenticate the same physical
   * device across reconnects without requiring a brand-new pairing code
   * every time the socket drops.
   */
  registerDevice({ deviceId, pairingCode, deviceSecret, deviceName, socket }) {
    let device = this.devicesById.get(deviceId);

    if (device) {
      // Reconnect of a known device: verify the secret matches before trusting it.
      if (device.deviceSecret !== deviceSecret) {
        throw new Error('Device secret mismatch');
      }
      device.socket = socket;
      device.pairingCode = pairingCode;
      device.deviceName = deviceName;
      device.lastSeen = Date.now();
    } else {
      device = new Device({ deviceId, pairingCode, deviceSecret, deviceName, socket });
      this.devicesById.set(deviceId, device);
    }

    this.devicesByPairingCode.set(pairingCode, device);
    device.sessionToken = device.sessionToken || uuidv4();
    this.devicesByToken.set(device.sessionToken, device);

    this._schedulePairingExpiry(device);
    return device;
  }

  /** Looks up a device by the pairing code a browser user typed in. */
  findByPairingCode(pairingCode) {
    return this.devicesByPairingCode.get(pairingCode) || null;
  }

  findByDeviceId(deviceId) {
    return this.devicesById.get(deviceId) || null;
  }

  removeDeviceSocket(deviceId) {
    const device = this.devicesById.get(deviceId);
    if (device) {
      device.socket = null;
    }
  }

  fullyRemoveDevice(deviceId) {
    const device = this.devicesById.get(deviceId);
    if (!device) return;
    this.devicesByPairingCode.delete(device.pairingCode);
    if (device.sessionToken) this.devicesByToken.delete(device.sessionToken);
    this.devicesById.delete(deviceId);
  }

  _schedulePairingExpiry(device) {
    if (device._pairingExpiryTimer) clearTimeout(device._pairingExpiryTimer);
    // Only expire the pairing code if no browser client is currently attached.
    device._pairingExpiryTimer = setTimeout(() => {
      if (!device.client) {
        this.devicesByPairingCode.delete(device.pairingCode);
      }
    }, this.pairingTtlMs);
  }

  generateNewPairingCode(deviceId) {
    const device = this.devicesById.get(deviceId);
    if (!device) return null;
    this.devicesByPairingCode.delete(device.pairingCode);
    const code = SessionManager.generatePairingCode();
    device.pairingCode = code;
    this.devicesByPairingCode.set(code, device);
    this._schedulePairingExpiry(device);
    return code;
  }

  static generatePairingCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}

class Device {
  constructor({ deviceId, pairingCode, deviceSecret, deviceName, socket }) {
    this.deviceId = deviceId;
    this.pairingCode = pairingCode;
    this.deviceSecret = deviceSecret;
    this.deviceName = deviceName;
    this.socket = socket;
    this.client = null; // currently paired browser WebSocket, if any
    this.sessionToken = null;
    this.lastSeen = Date.now();
    this.lastScreenInfo = null;
    this._pairingExpiryTimer = null;
  }

  isOnline() {
    return this.socket != null && this.socket.readyState === 1; // WebSocket.OPEN
  }
}

module.exports = { SessionManager, Device };
