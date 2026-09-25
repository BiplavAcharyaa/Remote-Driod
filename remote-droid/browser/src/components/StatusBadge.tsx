import type { ConnectionStatus } from '../lib/protocol';

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  idle: { label: 'Not connected', color: '#8A93A3' },
  connecting_server: { label: 'Connecting to server…', color: '#FFAB00' },
  awaiting_pairing_code: { label: 'Waiting to pair', color: '#FFAB00' },
  pairing: { label: 'Pairing…', color: '#FFAB00' },
  pair_failed: { label: 'Pairing failed', color: '#D50000' },
  negotiating: { label: 'Negotiating stream…', color: '#FFAB00' },
  streaming: { label: 'Live', color: '#00C853' },
  reconnecting: { label: 'Reconnecting…', color: '#FFAB00' },
  disconnected: { label: 'Disconnected', color: '#D50000' },
  error: { label: 'Error', color: '#D50000' },
};

export function StatusBadge({ status, message }: { status: ConnectionStatus; message?: string }) {
  const config = STATUS_CONFIG[status];
  return (
    <div style={styles.container}>
      <span style={{ ...styles.dot, backgroundColor: config.color }} />
      <span style={styles.label}>{config.label}</span>
      {message && <span style={styles.message}>— {message}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  label: { color: '#E6E9EF', fontSize: 14, fontWeight: 600 },
  message: { color: '#8A93A3', fontSize: 13 },
};
