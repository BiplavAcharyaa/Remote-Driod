import { useCallback, useRef } from 'react';
import type { RemoteCommand } from '../lib/protocol';

const ANDROID_KEYCODE_ENTER = 66;
const ANDROID_KEYCODE_DEL = 67;

/**
 * Captures keyboard input while the remote screen has focus and forwards it
 * to the phone. Printable characters are batched briefly and sent as
 * `text_input` (which the AccessibilityService applies via ACTION_SET_TEXT
 * to the currently focused field), while special keys (Enter, Backspace)
 * are sent immediately as discrete `key_event` commands.
 */
export function useKeyboardInput(sendCommand: (command: RemoteCommand) => void) {
  const bufferRef = useRef('');
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (bufferRef.current.length > 0) {
      sendCommand({ type: 'text_input', text: bufferRef.current });
      bufferRef.current = '';
    }
  }, [sendCommand]);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 120);
  }, [flush]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // Avoid interfering with browser shortcuts (Ctrl/Cmd/Alt combos).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        flush();
        sendCommand({ type: 'key_event', keyCode: ANDROID_KEYCODE_ENTER });
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        flush();
        sendCommand({ type: 'key_event', keyCode: ANDROID_KEYCODE_DEL });
        return;
      }

      if (e.key.length === 1) {
        // A single printable character (letters, digits, punctuation, space).
        e.preventDefault();
        bufferRef.current += e.key;
        scheduleFlush();
      }
      // Other special keys (Tab, arrows, function keys, etc.) are
      // intentionally not forwarded in this version; text fields are
      // reachable via tap-to-focus, and Enter/Backspace above cover the
      // most common editing needs.
    },
    [sendCommand, flush, scheduleFlush]
  );

  return { handleKeyDown };
}
