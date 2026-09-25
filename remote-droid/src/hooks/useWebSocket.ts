import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ConnectionConfig, DeviceInfo, ServerMessage, WsStatus } from "@/types";

const MAX_BACKOFF_MS = 8000;
const BASE_BACKOFF_MS = 500;
const HEARTBEAT_MS = 4000;
const HEARTBEAT_TIMEOUT_MS = 10000;

interface UseWebSocketOptions {
  onOffer: (sdp: string) => void;
  onRemoteIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onDeviceInfo: (device: DeviceInfo) => void;
}

export function useWebSocket({ onOffer, onRemoteIceCandidate, onDeviceInfo }: UseWebSocketOptions) {
  const [status, setStatus] = useState<WsStatus>("idle");
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const configRef = useRef<ConnectionConfig | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const clearTimers = () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
  };

  const send = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setInterval(() => {
      send({ type: "ping", t: Date.now() });
      if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = setTimeout(() => {
        // No pong in time -> treat connection as dead, force reconnect.
        socketRef.current?.close();
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_MS);
  }, [send]);

  const connect = useCallback(
    (config: ConnectionConfig) => {
      intentionalCloseRef.current = false;
      configRef.current = config;
      reconnectAttemptRef.current = 0;
      openSocket();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const openSocket = useCallback(() => {
    const config = configRef.current;
    if (!config) return;

    clearTimers();
    setStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");
    setLastError(null);

    const scheme = config.useTls ? "wss" : "ws";
    const url = `${scheme}://${config.host}:${config.port}/remote-droid`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setStatus("error");
      setLastError("Could not open a socket to that address.");
      scheduleReconnect();
      return;
    }
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus("awaiting-pair");
      send({ type: "pair", code: config.pairingCode, clientName: getClientName() });
    };

    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      handleServerMessage(msg);
    };

    ws.onerror = () => {
      setLastError("Connection error while talking to the device.");
    };

    ws.onclose = () => {
      heartbeatTimerRef.current && clearInterval(heartbeatTimerRef.current);
      heartbeatTimeoutRef.current && clearTimeout(heartbeatTimeoutRef.current);
      if (intentionalCloseRef.current) {
        setStatus("disconnected");
        return;
      }
      setStatus("reconnecting");
      scheduleReconnect();
    };

    function handleServerMessage(msg: ServerMessage) {
      switch (msg.type) {
        case "paired":
          reconnectAttemptRef.current = 0;
          setStatus("paired");
          setDevice(msg.device);
          onDeviceInfo(msg.device);
          startHeartbeat();
          break;
        case "pair-rejected":
          setStatus("error");
          setLastError(msg.reason || "Pairing code was rejected.");
          intentionalCloseRef.current = true;
          ws.close();
          break;
        case "webrtc-offer":
          onOffer(msg.sdp);
          break;
        case "ice-candidate":
          onRemoteIceCandidate(msg.candidate);
          break;
        case "device-info":
          setDevice(msg.device);
          onDeviceInfo(msg.device);
          break;
        case "pong":
          if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
          break;
        case "error":
          setLastError(msg.message);
          break;
      }
    }

    function scheduleReconnect() {
      if (intentionalCloseRef.current) return;
      const attempt = reconnectAttemptRef.current++;
      const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      reconnectTimerRef.current = setTimeout(() => {
        openSocket();
      }, delay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDeviceInfo, onOffer, onRemoteIceCandidate, send, startHeartbeat]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimers();
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("disconnected");
    setDevice(null);
  }, []);

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      clearTimers();
      socketRef.current?.close();
    };
  }, []);

  return { status, device, lastError, connect, disconnect, send };
}

function getClientName(): string {
  const ua = navigator.userAgent;
  if (/Mac/.test(ua)) return "MacBook — Remote Droid Web";
  if (/Windows/.test(ua)) return "Windows PC — Remote Droid Web";
  if (/Linux/.test(ua)) return "Linux PC — Remote Droid Web";
  return "Browser — Remote Droid Web";
}
