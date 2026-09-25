import { useEffect, useRef } from 'react';
import type { RemoteCommand, ScreenInfo } from '../lib/protocol';
import { useTouchMapper } from '../hooks/useTouchMapper';
import { useKeyboardInput } from '../hooks/useKeyboardInput';

interface Props {
  stream: MediaStream | null;
  screenInfo: ScreenInfo | null;
  onCommand: (command: RemoteCommand) => void;
}

/**
 * Renders the phone's live screen as a real <video> element fed directly by
 * the WebRTC MediaStream (srcObject) — this is a genuine continuous video
 * stream, not a sequence of images drawn to a canvas. All pointer and
 * keyboard interaction on top of the video is translated into normalized
 * remote-control commands.
 */
export function RemoteScreen({ stream, screenInfo, onCommand }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const { handlePointerDown, handlePointerMove, handlePointerUp, handleWheel } = useTouchMapper(
    videoRef,
    onCommand
  );
  const { handleKeyDown } = useKeyboardInput(onCommand);

  const isPortrait = !screenInfo || screenInfo.height >= screenInfo.width;

  return (
    <div
      ref={containerRef}
      style={styles.container}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div style={{ ...styles.videoFrame, aspectRatio: isPortrait ? '9 / 19.5' : '19.5 / 9' }}>
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={styles.video}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : (
          <div style={styles.placeholder}>Waiting for live video stream…</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    outline: 'none',
    minHeight: 0,
    padding: 16,
  },
  videoFrame: {
    maxHeight: '100%',
    maxWidth: '100%',
    height: '100%',
    background: '#000',
    borderRadius: 8,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 1px #232a35',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    cursor: 'crosshair',
    userSelect: 'none',
  },
  placeholder: { color: '#8A93A3', fontSize: 14 },
};
