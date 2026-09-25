import { useCallback, useRef } from 'react';
import type { RemoteCommand } from '../lib/protocol';

const LONG_PRESS_MS = 500;
const DOUBLE_TAP_WINDOW_MS = 300;
const DRAG_MOVE_THRESHOLD_PX = 8;
const SCROLL_SENSITIVITY = 0.0015;

interface NormalizedPoint {
  x: number;
  y: number;
}

/**
 * Converts raw mouse/wheel/keyboard interaction on the <video> element into
 * normalized [0,1] RemoteCommand touch events, correctly accounting for the
 * video's actual rendered box (including letterboxing) so a click at the
 * edge of the visible video maps to the true edge of the phone screen —
 * accurate across portrait and landscape, and independent of how large the
 * browser window is.
 */
export function useTouchMapper(
  videoRef: React.RefObject<HTMLVideoElement>,
  sendCommand: (command: RemoteCommand) => void
) {
  const pointerDownAt = useRef<{ point: NormalizedPoint; time: number } | null>(null);
  const lastPointerPoint = useRef<NormalizedPoint | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const lastTapTime = useRef(0);
  const lastTapPoint = useRef<NormalizedPoint | null>(null);
  const isDragging = useRef(false);

  /** Maps a raw client (pixel) coordinate to a normalized [0,1] point relative to the actual video content box. */
  const toNormalized = useCallback(
    (clientX: number, clientY: number): NormalizedPoint | null => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight) return null;

      const rect = video.getBoundingClientRect();
      const videoAspect = video.videoWidth / video.videoHeight;
      const boxAspect = rect.width / rect.height;

      // object-fit: contain letterboxing math — the <video> element is
      // rendered with CSS `object-fit: contain`, so we must find the actual
      // drawn content rectangle within the element's box.
      let contentWidth = rect.width;
      let contentHeight = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (videoAspect > boxAspect) {
        contentHeight = rect.width / videoAspect;
        offsetY = (rect.height - contentHeight) / 2;
      } else {
        contentWidth = rect.height * videoAspect;
        offsetX = (rect.width - contentWidth) / 2;
      }

      const localX = clientX - rect.left - offsetX;
      const localY = clientY - rect.top - offsetY;

      if (localX < 0 || localY < 0 || localX > contentWidth || localY > contentHeight) {
        return null; // click landed in the letterbox area, not on the actual screen image
      }

      return {
        x: Math.min(1, Math.max(0, localX / contentWidth)),
        y: Math.min(1, Math.max(0, localY / contentHeight)),
      };
    },
    [videoRef]
  );

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLVideoElement>) => {
      const point = toNormalized(e.clientX, e.clientY);
      if (!point) return;

      pointerDownAt.current = { point, time: Date.now() };
      lastPointerPoint.current = point;
      longPressFired.current = false;
      isDragging.current = false;

      longPressTimer.current = setTimeout(() => {
        if (pointerDownAt.current) {
          longPressFired.current = true;
          sendCommand({ type: 'long_press', x: point.x, y: point.y, durationMs: LONG_PRESS_MS });
        }
      }, LONG_PRESS_MS);

      (e.target as HTMLVideoElement).setPointerCapture(e.pointerId);
    },
    [toNormalized, sendCommand]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLVideoElement>) => {
      if (!pointerDownAt.current) return;
      const point = toNormalized(e.clientX, e.clientY);
      if (!point) return;

      const dx = Math.abs(e.clientX - (videoRef.current?.getBoundingClientRect().left ?? 0));
      const startPoint = pointerDownAt.current.point;
      const videoRect = videoRef.current?.getBoundingClientRect();
      const pixelDist = videoRect
        ? Math.hypot(
            (point.x - startPoint.x) * videoRect.width,
            (point.y - startPoint.y) * videoRect.height
          )
        : 0;

      if (!isDragging.current && pixelDist > DRAG_MOVE_THRESHOLD_PX) {
        isDragging.current = true;
        clearLongPressTimer(); // movement means this isn't a long-press-in-place
      }

      lastPointerPoint.current = point;
    },
    [toNormalized, videoRef]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLVideoElement>) => {
      clearLongPressTimer();
      const down = pointerDownAt.current;
      pointerDownAt.current = null;
      if (!down) return;

      const upPoint = toNormalized(e.clientX, e.clientY) ?? lastPointerPoint.current ?? down.point;
      const elapsed = Date.now() - down.time;

      if (longPressFired.current) {
        // Long-press already dispatched on timer; nothing further to send on release.
        return;
      }

      if (isDragging.current) {
        const videoRect = videoRef.current?.getBoundingClientRect();
        const pixelDist = videoRect
          ? Math.hypot((upPoint.x - down.point.x) * videoRect.width, (upPoint.y - down.point.y) * videoRect.height)
          : 0;

        // Fast, short movement = swipe. Slower or longer movement = drag
        // (e.g. reordering items, dragging sliders). Both map to the same
        // underlying gesture primitive on the Android side but with
        // different semantics/duration for apps that distinguish them.
        const isSwipeLike = elapsed < 300 && pixelDist > 40;
        sendCommand({
          type: isSwipeLike ? 'swipe' : 'drag',
          x1: down.point.x,
          y1: down.point.y,
          x2: upPoint.x,
          y2: upPoint.y,
          durationMs: Math.max(80, Math.min(elapsed, 2000)),
        });
        return;
      }

      // Plain tap or double-tap
      const now = Date.now();
      const isDoubleTap =
        now - lastTapTime.current < DOUBLE_TAP_WINDOW_MS &&
        lastTapPoint.current &&
        Math.hypot(upPoint.x - lastTapPoint.current.x, upPoint.y - lastTapPoint.current.y) < 0.03;

      if (isDoubleTap) {
        sendCommand({ type: 'double_tap', x: upPoint.x, y: upPoint.y });
        lastTapTime.current = 0;
        lastTapPoint.current = null;
      } else {
        sendCommand({ type: 'tap', x: upPoint.x, y: upPoint.y });
        lastTapTime.current = now;
        lastTapPoint.current = upPoint;
      }
    },
    [toNormalized, sendCommand, videoRef]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLVideoElement>) => {
      e.preventDefault();
      const point = toNormalized(e.clientX, e.clientY);
      if (!point) return;
      sendCommand({
        type: 'scroll',
        x: point.x,
        y: point.y,
        deltaX: e.deltaX * SCROLL_SENSITIVITY,
        deltaY: e.deltaY * SCROLL_SENSITIVITY,
      });
    },
    [toNormalized, sendCommand]
  );

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
  };
}
