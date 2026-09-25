import { useCallback, useEffect, useRef, useState } from 'react';
import { RemoteSessionClient } from './lib/RemoteSessionClient';
import type { AppInfo, ConnectionStatus, RemoteCommand, ScreenInfo } from './lib/protocol';
import { PairingScreen } from './components/PairingScreen';
import { RemoteScreen } from './components/RemoteScreen';
import { ControlBar } from './components/ControlBar';
import { StatusBadge } from './components/StatusBadge';

const DEFAULT_SERVER_URL =
  (import.meta.env.VITE_SIGNALING_SERVER_URL as string | undefined) ?? 'ws://localhost:8080';

const CONNECTED_STATUSES: ConnectionStatus[] = [
  'awaiting_pairing_code',
  'pairing',
  'negotiating',
  'streaming',
  'reconnecting',
];

export default function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenInfo, setScreenInfo] = useState<ScreenInfo | null>(null);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const clientRef = useRef<RemoteSessionClient | null>(null);

  const isSessionActive = CONNECTED_STATUSES.includes(status);

  const handleConnect = useCallback(
    (pairingCode: string) => {
      const client = new RemoteSessionClient(serverUrl, {
        onStatusChange: (newStatus, message) => {
          setStatus(newStatus);
          setStatusMessage(message);
        },
        onRemoteStream: (mediaStream) => setStream(mediaStream),
        onScreenInfo: (info) => setScreenInfo(info),
        onAppList: (appList) => setApps(appList),
        onDeviceInfo: (_id, name) => setDeviceName(name),
      });
      clientRef.current = client;
      client.connect(pairingCode);
    },
    [serverUrl]
  );

  const handleDisconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setStream(null);
    setScreenInfo(null);
    setApps([]);
    setDeviceName(null);
    setStatus('idle');
  }, []);

  const handleCommand = useCallback((command: RemoteCommand) => {
    clientRef.current?.sendControlCommand(command);
  }, []);

  const handleRequestAppList = useCallback(() => {
    clientRef.current?.sendControlCommand({ type: 'list_apps' });
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  if (!isSessionActive && status !== 'pair_failed') {
    return (
      <PairingScreen
        serverUrl={serverUrl}
        onServerUrlChange={setServerUrl}
        onConnect={handleConnect}
      />
    );
  }

  if (status === 'pair_failed') {
    return (
      <PairingScreen
        serverUrl={serverUrl}
        onServerUrlChange={setServerUrl}
        onConnect={handleConnect}
        errorMessage={statusMessage ?? 'Pairing failed. Check the code and try again.'}
      />
    );
  }

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.appTitle}>Remote Droid</span>
          {deviceName && <span style={styles.deviceName}>{deviceName}</span>}
        </div>
        <StatusBadge status={status} message={statusMessage} />
      </div>

      <RemoteScreen stream={stream} screenInfo={screenInfo} onCommand={handleCommand} />

      <ControlBar
        onCommand={handleCommand}
        onDisconnect={handleDisconnect}
        apps={apps}
        onRequestAppList={handleRequestAppList}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#0e1116',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid #232a35',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  appTitle: { color: '#E6E9EF', fontWeight: 700, fontSize: 16 },
  deviceName: { color: '#8A93A3', fontSize: 13 },
};
