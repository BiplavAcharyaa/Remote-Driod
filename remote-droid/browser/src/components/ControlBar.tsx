import { useState } from 'react';
import type { AppInfo, RemoteCommand } from '../lib/protocol';

interface Props {
  onCommand: (command: RemoteCommand) => void;
  onDisconnect: () => void;
  apps: AppInfo[];
  onRequestAppList: () => void;
}

export function ControlBar({ onCommand, onDisconnect, apps, onRequestAppList }: Props) {
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [search, setSearch] = useState('');

  const filteredApps = apps.filter((a) => a.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={styles.bar}>
      <div style={styles.navGroup}>
        <button style={styles.navButton} title="Back" onClick={() => onCommand({ type: 'back' })}>
          ◁
        </button>
        <button style={styles.navButton} title="Home" onClick={() => onCommand({ type: 'home' })}>
          ○
        </button>
        <button style={styles.navButton} title="Recent Apps" onClick={() => onCommand({ type: 'recents' })}>
          ▢
        </button>
      </div>

      <button
        style={styles.appsButton}
        onClick={() => {
          setShowAppLauncher((s) => !s);
          if (!showAppLauncher) onRequestAppList();
        }}
      >
        Apps
      </button>

      <button style={styles.disconnectButton} onClick={onDisconnect}>
        Disconnect
      </button>

      {showAppLauncher && (
        <div style={styles.appDrawer}>
          <input
            style={styles.appSearch}
            placeholder="Search apps…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div style={styles.appList}>
            {filteredApps.length === 0 && <div style={styles.appEmpty}>No apps found</div>}
            {filteredApps.map((app) => (
              <button
                key={app.packageName}
                style={styles.appItem}
                onClick={() => {
                  onCommand({ type: 'launch_app', packageName: app.packageName });
                  setShowAppLauncher(false);
                }}
              >
                {app.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    background: '#151a21',
    borderTop: '1px solid #232a35',
    position: 'relative',
  },
  navGroup: { display: 'flex', gap: 8 },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: '1px solid #2A3140',
    background: '#1A1F27',
    color: '#E6E9EF',
    fontSize: 16,
    cursor: 'pointer',
  },
  appsButton: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid #2A3140',
    background: '#1A1F27',
    color: '#E6E9EF',
    fontSize: 13,
    cursor: 'pointer',
  },
  disconnectButton: {
    marginLeft: 'auto',
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    background: '#D50000',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  appDrawer: {
    position: 'absolute',
    bottom: '100%',
    left: 16,
    width: 320,
    maxHeight: 400,
    background: '#1A1F27',
    border: '1px solid #2A3140',
    borderRadius: 12,
    padding: 12,
    boxShadow: '0 -10px 30px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  appSearch: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #2A3140',
    background: '#0E1116',
    color: '#E6E9EF',
    fontSize: 13,
    outline: 'none',
  },
  appList: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320 },
  appItem: {
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: '#E6E9EF',
    fontSize: 13,
    cursor: 'pointer',
  },
  appEmpty: { color: '#8A93A3', fontSize: 13, padding: 8, textAlign: 'center' },
};
