import { useCallback, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { PairingScreen } from "@/components/PairingScreen";
import { StatusBar } from "@/components/StatusBar";
import { RemoteScreen } from "@/components/RemoteScreen";
import { ControlBar } from "@/components/ControlBar";
import type { ClientMessage, ConnectionConfig, DeviceInfo, InputAction, NavAction } from "@/types";

export default function App() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [keyboardActive, setKeyboardActive] = useState(false);

  const [wsSendRef] = useState<{ current: (msg: ClientMessage) => void }>(() => ({
    current: () => {},
  }));

  const { videoStream, status: rtcStatus, stats, handleOffer, handleRemoteIceCandidate, close: closeRtc } =
    useWebRTC({ send: (msg) => wsSendRef.current(msg) });

  const ws = useWebSocket({
    onOffer: handleOffer,
    onRemoteIceCandidate: handleRemoteIceCandidate,
    onDeviceInfo: setDevice,
  });

  wsSendRef.current = ws.send;

  const handleConnect = useCallback(
    (config: ConnectionConfig) => {
      ws.connect(config);
    },
    [ws]
  );

  const handleDisconnect = useCallback(() => {
    ws.disconnect();
    closeRtc();
    setDevice(null);
    setKeyboardActive(false);
  }, [ws, closeRtc]);

  const handleInput = useCallback(
    (action: InputAction) => {
      ws.send({ type: "input", action });
    },
    [ws]
  );

  const handleNav = useCallback(
    (action: NavAction) => {
      ws.send({ type: "nav", action });
    },
    [ws]
  );

  const isPaired = ws.status === "paired" || ws.status === "reconnecting";

  if (!isPaired) {
    return (
      <PairingScreen
        onConnect={handleConnect}
        isConnecting={ws.status === "connecting" || ws.status === "awaiting-pair"}
        errorMessage={ws.lastError}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-graphite-950">
      <StatusBar
        wsStatus={ws.status}
        rtcStatus={rtcStatus}
        device={device}
        stats={stats}
        onDisconnect={handleDisconnect}
      />

      <main className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <RemoteScreen
          videoStream={videoStream}
          device={device}
          rtcConnected={rtcStatus === "connected"}
          onInput={handleInput}
          keyboardActive={keyboardActive}
          onKeyboardActiveChange={setKeyboardActive}
        />
      </main>

      <ControlBar
        onNav={handleNav}
        keyboardActive={keyboardActive}
        onToggleKeyboard={() => setKeyboardActive((v) => !v)}
        disabled={rtcStatus !== "connected"}
      />
    </div>
  );
}
