import type { ContentRect } from "@/types";

/**
 * The <video> element renders with object-fit: contain, so the actual video
 * picture is letterboxed/pillarboxed inside the element's box. Any pointer
 * math must first find the real picture rectangle, then map into device
 * pixel space, ignoring clicks that land in the letterbox bars.
 */
export function getVideoContentRect(
  videoBoxWidth: number,
  videoBoxHeight: number,
  videoWidth: number,
  videoHeight: number
): ContentRect {
  if (!videoWidth || !videoHeight || !videoBoxWidth || !videoBoxHeight) {
    return { offsetX: 0, offsetY: 0, width: videoBoxWidth, height: videoBoxHeight };
  }

  const boxRatio = videoBoxWidth / videoBoxHeight;
  const videoRatio = videoWidth / videoHeight;

  let width: number;
  let height: number;

  if (videoRatio > boxRatio) {
    // Video is relatively wider than the box -> pillarboxed top/bottom slack removed,
    // width fills the box, height is letterboxed.
    width = videoBoxWidth;
    height = videoBoxWidth / videoRatio;
  } else {
    height = videoBoxHeight;
    width = videoBoxHeight * videoRatio;
  }

  return {
    offsetX: (videoBoxWidth - width) / 2,
    offsetY: (videoBoxHeight - height) / 2,
    width,
    height,
  };
}

/**
 * Maps a pointer position measured relative to the video element's bounding
 * box into device pixel coordinates (0,0 top-left of the phone screen).
 * Returns null if the point falls outside the actual picture (letterbox bars).
 */
export function mapPointToDevice(
  clientXInBox: number,
  clientYInBox: number,
  contentRect: ContentRect,
  deviceWidth: number,
  deviceHeight: number
): { x: number; y: number } | null {
  const { offsetX, offsetY, width, height } = contentRect;

  const localX = clientXInBox - offsetX;
  const localY = clientYInBox - offsetY;

  if (localX < 0 || localY < 0 || localX > width || localY > height) {
    return null;
  }

  const normX = localX / width;
  const normY = localY / height;

  const x = clamp(Math.round(normX * deviceWidth), 0, deviceWidth - 1);
  const y = clamp(Math.round(normY * deviceHeight), 0, deviceHeight - 1);

  return { x, y };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}
