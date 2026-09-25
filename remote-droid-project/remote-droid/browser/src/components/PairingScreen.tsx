import { useState } from 'react';

interface Props {
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
  onConnect: (pairingCode: string) => void;
  errorMessage?: string;
}

export function PairingScreen({ serverUrl, onServerUrlChange, onConnect, errorMessage }: Props) {
  const [code, setCode] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const digitsOnly = code.replace(/\D/g, '').slice(0, 6);
  const canSubmit = digitsOnly.length === 6;

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Remote Droid</h1>
        <p style={styles.subtitle}>Enter the 6-digit pairing code shown on your phone</p>

        <input
          style={styles.codeInput}
          value={digitsOnly}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) onConnect(digitsOnly);
          }}
          placeholder="000000"
          inputMode="numeric"
          autoFocus
          maxLength={6}
        />

        {errorMessage && <div style={styles.error}>{errorMessage}</div>}

        <button
          style={{ ...styles.connectButton, opacity: canSubmit ? 1 : 0.5 }}
          disabled={!canSubmit}
          onClick={() => onConnect(digitsOnly)}
        >
          Connect
        </button>

        <button style={styles.settingsToggle} onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? 'Hide' : 'Show'} server settings
        </button>

        {showSettings && (
          <div style={styles.settingsBox}>
            <label style={styles.settingsLabel}>Signaling server URL</label>
            <input
              style={styles.settingsInput}
              value={serverUrl}
              onChange={(e) => onServerUrlChange(e.target.value)}
              placeholder="ws://192.168.1.20:8080"
            />
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0e1116',
  },
  card: {
    background: '#1A1F27',
    borderRadius: 20,
    padding: '40px 36px',
    width: 360,
    maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  title: { color: '#E6E9EF', fontSize: 26, fontWeight: 700, margin: 0, textAlign: 'center' },
  subtitle: { color: '#8A93A3', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  codeInput: {
    fontSize: 32,
    fontFamily: 'monospace',
    letterSpacing: 6,
    textAlign: 'center',
    padding: '14px 0',
    borderRadius: 12,
    border: '1px solid #2A3140',
    background: '#0E1116',
    color: '#00C853',
    outline: 'none',
  },
  error: { color: '#FF5252', fontSize: 13, textAlign: 'center', marginTop: 12 },
  connectButton: {
    marginTop: 20,
    padding: '14px 0',
    borderRadius: 12,
    border: 'none',
    background: '#1565C0',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  settingsToggle: {
    marginTop: 20,
    background: 'transparent',
    border: 'none',
    color: '#8A93A3',
    fontSize: 12,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  settingsBox: { marginTop: 12 },
  settingsLabel: { color: '#8A93A3', fontSize: 12, display: 'block', marginBottom: 6 },
  settingsInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #2A3140',
    background: '#0E1116',
    color: '#E6E9EF',
    fontSize: 13,
    boxSizing: 'border-box',
  },
};
