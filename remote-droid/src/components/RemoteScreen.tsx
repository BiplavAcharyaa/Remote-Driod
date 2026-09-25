import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceInfo, InputAction } from "@/types";
import { getVideoContentRect, mapPointToDevice, distance } from "@/utils/coordinateMapping";

const LONG_PRESS_MS = 480;
const MOVE_THRESHOLD_PX = 8;
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_DIST_PX = 32;
const DRAG_MOVE_THROTTLE_MS = 16; // ~60fps

interface TapMark {
  id: number;
  x: number;
  y: number;
  kind: "tap" | "long-press";
}

interface RemoteScreenProps {
  videoStream: MediaStream | null;
  device: DeviceInfo | null;
  rtcConnected: boolean;
  onInput: (action: InputAction) => void;
  keyboardActive: boolean;
  onKeyboardActiveChange: (active: boolean) => void;
}

export function RemoteScreen({
  videoStream,
  device,
  rtcConnected,
  onInput,
  keyboardActive,
  onKeyboardActiveChange,
}: RemoteScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);

  const [tapMarks, setTapMarks] = useState<TapMark[]>([]);
  const tapMarkIdRef = useRef(0);

  const pointerStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    moved: boolean;
    dragging: boolean;
    longPressFired: boolean;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    lastDragSend: number;
  } | null>(null);

  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  const addTapMark = (x: number, y: number, kind: TapMark["kind"]) => {
    const id = tapMarkIdRef.current++;
    setTapMarks((marks) => [...marks, { id, x, y, kind }]);
    setTimeout(() => {
      setTapMarks((marks) => marks.filter((m) => m.id !== id));
    }, 420);
  };

  /** Converts a pointer/mouse event's page position into device pixel coordinates, or null if outside the picture. */
  const resolveDevicePoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number; boxX: number; boxY: number } | null => {
      const container = containerRef.current;
      const video = videoRef.current;
      if (!container || !video || !device) return null;

      const rect = container.getBoundingClientRect();
      const boxX = clientX - rect.left;
      const boxY = clientY - rect.top;

      const contentRect = getVideoContentRect(
        rect.width,
        rect.height,
        video.videoWidth || device.screenWidth,
        video.videoHeight || device.screenHeight
      );

      const mapped = mapPointToDevice(boxX, boxY, contentRect, device.screenWidth, device.screenHeight);
      if (!mapped) return null;
      return { ...mapped, boxX, boxY };
    },
    [device]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!rtcConnected || !device) return;
      const point = resolveDevicePoint(e.clientX, e.clientY);
      if (!point) return;

      e.currentTarget.setPointerCapture(e.pointerId);

      const state = {
        pointerId: e.pointerId,
        startX: point.x,
        startY: point.y,
        startTime: performance.now(),
        moved: false,
        dragging: false,
        longPressFired: false,
        longPressTimer: null as ReturnType<typeof setTimeout> | null,
        lastDragSend: 0,
      };
      pointerStateRef.current = state;

      state.longPressTimer = setTimeout(() => {
        const s = pointerStateRef.current;
        if (!s || s.moved) return;
        s.longPressFired = true;
        onInput({ kind: "long-press", x: s.startX, y: s.startY, durationMs: LONG_PRESS_MS });
        addTapMark(point.boxX, point.boxY, "long-press");
      }, LONG_PRESS_MS);
    },
    [rtcConnected, device, resolveDevicePoint, onInput]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = pointerStateRef.current;
      if (!state || state.pointerId !== e.pointerId || !device) return;

      const point = resolveDevicePoint(e.clientX, e.clientY);
      if (!point) return;

      const travelled = distance(state.startX, state.startY, point.x, point.y);

      if (!state.moved && travelled > MOVE_THRESHOLD_PX) {
        state.moved = true;
        if (state.longPressTimer) clearTimeout(state.longPressTimer);

        state.dragging = true;
        const originX = state.longPressFired ? state.startX : state.startX;
        const originY = state.longPressFired ? state.startY : state.startY;
        onInput({ kind: "drag-start", x: originX, y: originY });
      }

      if (state.dragging) {
        const now = performance.now();
        if (now - state.lastDragSend >= DRAG_MOVE_THROTTLE_MS) {
          state.lastDragSend = now;
          onInput({ kind: "drag-move", x: point.x, y: point.y });
        }
      }
    },
    [device, resolveDevicePoint, onInput]
  );

  const endPointerInteraction = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = pointerStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;

      if (state.longPressTimer) clearTimeout(state.longPressTimer);
      const point = resolveDevicePoint(e.clientX, e.clientY) ?? { x: state.startX, y: state.startY, boxX: 0, boxY: 0 };

      if (state.dragging) {
        onInput({ kind: "drag-end", x: point.x, y: point.y });
      } else if (!state.longPressFired) {
        const now = performance.now();
        const last = lastTapRef.current;
        const isDoubleTap =
          last &&
          now - last.time < DOUBLE_TAP_MS &&
          distance(last.x, last.y, point.x, point.y) < DOUBLE_TAP_DIST_PX;

        if (isDoubleTap) {
          onInput({ kind: "double-tap", x: point.x, y: point.y });
          lastTapRef.current = null;
        } else {
          onInput({ kind: "tap", x: point.x, y: point.y });
          lastTapRef.current = { x: point.x, y: point.y, time: now };
        }
        addTapMark(point.boxX, point.boxY, "tap");
      }

      pointerStateRef.current = null;
    },
    [resolveDevicePoint, onInput]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!rtcConnected || !device) return;
      const point = resolveDevicePoint(e.clientX, e.clientY);
      if (!point) return;
      e.preventDefault();
      onInput({ kind: "scroll", x: point.x, y: point.y, deltaX: e.deltaX, deltaY: e.deltaY });
    },
    [rtcConnected, device, resolveDevicePoint, onInput]
  );

  // ---- Keyboard: text goes through a hidden input so IME/composition works. ----
  const handleHiddenInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      const text = target.value;
      if (text) {
        onInput({ kind: "text", text });
        target.value = "";
      }
    },
    [onInput]
  );

  const handleHiddenKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const map: Record<string, InputAction | undefined> = {
        Backspace: { kind: "key", keyCode: "DEL" },
        Delete: { kind: "key", keyCode: "FORWARD_DEL" },
        Enter: { kind: "key", keyCode: "ENTER" },
        Tab: { kind: "key", keyCode: "TAB" },
        ArrowLeft: { kind: "key", keyCode: "DPAD_LEFT" },
        ArrowRight: { kind: "key", keyCode: "DPAD_RIGHT" },
        ArrowUp: { kind: "key", keyCode: "DPAD_UP" },
        ArrowDown: { kind: "key", keyCode: "DPAD_DOWN" },
        Escape: { kind: "key", keyCode: "ESCAPE" },
      };
      const action = map[e.key];
      if (action) {
        e.preventDefault();
        onInput(action);
      }
    },
    [onInput]
  );

  useEffect(() => {
    if (keyboardActive) {
      hiddenInputRef.current?.focus();
    } else {
      hiddenInputRef.current?.blur();
    }
  }, [keyboardActive]);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        ref={containerRef}
        className="relative aspect-auto h-full max-h-full w-auto touch-none select-none overflow-hidden rounded-2xl bg-black shadow-panel ring-1 ring-white/5"
        style={{
          aspectRatio: device ? `${device.screenWidth} / ${device.screenHeight}` : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerInteraction}
        onPointerCancel={endPointerInteraction}
        onPointerLeave={(e) => {
          if (pointerStateRef.current?.pointerId === e.pointerId) endPointerInteraction(e);
        }}
        onWheel={handleWheel}
        onClick={() => onKeyboardActiveChange(true)}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="pointer-events-none h-full w-full object-contain"
        />

        {!videoStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-graphite-900/90 text-graphite-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-graphite-600 border-t-signal" />
            <p className="font-display text-sm">Waiting for the phone's video stream…</p>
          </div>
        )}

        {tapMarks.map((mark) => (
          <span
            key={mark.id}
            className={`pointer-events-none absolute rounded-full border-2 border-signal ${
              mark.kind === "long-press" ? "h-16 w-16 animate-pulseRing" : "h-10 w-10 animate-tapFlash"
            }`}
            style={{ left: mark.x, top: mark.y, transform: "translate(-50%, -50%)" }}
          />
        ))}

        <textarea
          ref={hiddenInputRef}
          className="absolute -left-96 h-px w-px opacity-0"
          aria-hidden
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onInput={handleHiddenInput}
          onKeyDown={handleHiddenKeyDown}
          onBlur={() => onKeyboardActiveChange(false)}
        />
      </div>
    </div>
  );
}
