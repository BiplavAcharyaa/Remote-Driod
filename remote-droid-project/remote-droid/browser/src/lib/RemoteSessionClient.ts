import type {
  ClientToServerMessage,
  ServerToClientMessage,
  ConnectionStatus,
  ScreenInfo,
  AppInfo,
  RemoteCommand,
} from './protocol';

export interface RemoteSessionCallbacks {
  onStatusChange: (status: ConnectionStatus, message?: string) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onScreenInfo: (info: ScreenInfo) => void;
  onAppList: (apps: AppInfo[]) => void;
  onDeviceInfo: (deviceId: string, deviceName: string) => void;
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * Owns the WebSocket connection to the Node.js signaling server and the
 * RTCPeerConnection used to receive the phone's live screen as a real
 * WebRTC video track (never a series of images). Also exposes a data
 * channel fallback for control commands and provides the pairing flow.
 */
export class RemoteSessionClient {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private controlChannel: RTCDataChannel | null = null;
  private serverUrl: string;
  private pairingCode: string | null = null;
  private shouldRun = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  constructor(
    serverUrl: string,
    private callbacks: RemoteSessionCallbacks
  ) {
    this.serverUrl = serverUrl;
  }

  /** Begins connecting to the signaling server and pairs using the given code. */
  connect(pairingCode: string) {
    this.pairingCode = pairingCode;
    this.shouldRun = true;
    this.reconnectAttempt = 0;
    this.openSocket();
  }

  disconnect() {
    this.shouldRun = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.send({ type: 'disconnect' });
    this.teardownPeerConnection();
    this.ws?.close();
    this.ws = null;
    this.callbacks.onStatusChange('disconnected');
  }

  sendControlCommand(command: RemoteCommand) {
    // Prefer the low-latency WebRTC data channel when open; fall back to
    // the signaling WebSocket so control still works during the brief
    // window before the peer connection is fully established.
    if (this.controlChannel && this.controlChannel.readyState === 'open') {
      this.controlChannel.send(JSON.stringify(command));
    } else {
      this.send({ type: 'control', command });
    }
  }

  private openSocket() {
    if (!this.shouldRun) return;
    this.callbacks.onStatusChange('connecting_server');

    const ws = new WebSocket(this.serverUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.callbacks.onStatusChange('awaiting_pairing_code');
      if (this.pairingCode) {
        this.send({ type: 'pair', pairingCode: this.pairingCode });
        this.callbacks.onStatusChange('pairing');
      }
      this.startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerToClientMessage;
        this.handleMessage(msg);
      } catch (e) {
        console.error('Failed to parse signaling message', e);
      }
    };

    ws.onclose = () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.teardownPeerConnection();
      if (this.shouldRun) {
        this.callbacks.onStatusChange('reconnecting');
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will follow; nothing additional needed here.
    };
  }

  private scheduleReconnect() {
    this.reconnectAttempt += 1;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** Math.min(this.reconnectAttempt, 4),
      RECONNECT_MAX_DELAY_MS
    );
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldRun) this.openSocket();
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'heartbeat' });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private async handleMessage(msg: ServerToClientMessage) {
    switch (msg.type) {
      case 'paired':
        this.callbacks.onDeviceInfo(msg.deviceId, msg.deviceName);
        if (msg.screenInfo) this.callbacks.onScreenInfo(msg.screenInfo);
        this.callbacks.onStatusChange('negotiating');
        break;

      case 'pair_failed':
        this.callbacks.onStatusChange('pair_failed', msg.message);
        break;

      case 'device_offer':
        await this.handleOffer(msg.sdp);
        break;

      case 'device_ice_candidate':
        await this.handleRemoteIceCandidate(msg.candidate, msg.sdpMid, msg.sdpMLineIndex);
        break;

      case 'device_screen_info':
        this.callbacks.onScreenInfo({
          width: msg.width,
          height: msg.height,
          rotation: msg.rotation,
          densityDpi: msg.densityDpi,
        });
        break;

      case 'device_app_list':
        this.callbacks.onAppList(msg.apps);
        break;

      case 'device_disconnected':
        this.teardownPeerConnection();
        this.callbacks.onStatusChange('awaiting_pairing_code', 'Phone disconnected');
        break;

      case 'session_terminated':
        this.teardownPeerConnection();
        this.callbacks.onStatusChange('disconnected', 'Session ended');
        this.shouldRun = false;
        break;

      case 'error':
        this.callbacks.onStatusChange('error', msg.message);
        break;

      case 'pong':
        break;
    }
  }

  private async handleOffer(sdp: string) {
    this.teardownPeerConnection();

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.pc = pc;

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.callbacks.onRemoteStream(event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: 'client_ice_candidate',
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          this.callbacks.onStatusChange('streaming');
          break;
        case 'disconnected':
        case 'failed':
          this.callbacks.onStatusChange('reconnecting');
          break;
      }
    };

    pc.ondatachannel = (event) => {
      this.controlChannel = event.channel;
    };

    await pc.setRemoteDescription({ type: 'offer', sdp });

    for (const candidate of this.pendingIceCandidates) {
      await pc.addIceCandidate(candidate);
    }
    this.pendingIceCandidates = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.send({ type: 'answer', sdp: answer.sdp ?? '' });
  }

  private async handleRemoteIceCandidate(candidate: string, sdpMid: string | null, sdpMLineIndex: number) {
    const init: RTCIceCandidateInit = { candidate, sdpMid: sdpMid ?? undefined, sdpMLineIndex };
    if (this.pc && this.pc.remoteDescription) {
      try {
        await this.pc.addIceCandidate(init);
      } catch (e) {
        console.error('Failed to add ICE candidate', e);
      }
    } else {
      this.pendingIceCandidates.push(init);
    }
  }

  private teardownPeerConnection() {
    this.controlChannel?.close();
    this.controlChannel = null;
    this.pc?.getSenders().forEach((s) => s.track?.stop());
    this.pc?.close();
    this.pc = null;
    this.pendingIceCandidates = [];
  }

  private send(msg: ClientToServerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
