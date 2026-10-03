import { FAN_COMPRESS, LINE_HEIGHT_PX, PAGE_HEIGHT_PX } from "./constants";

/** Distance from the center to the card `n` steps out, in px. A geometric
 * series: each step adds `FAN_COMPRESS` times what the previous step added,
 * so the sequence converges instead of marching off screen. */
function fanOffset(n: number, step: number): number {
  return (step * (1 - FAN_COMPRESS ** n)) / (1 - FAN_COMPRESS);
}

function wheelDeltaToPixels(delta: number, mode: number): number {
  if (mode === 1) return delta * LINE_HEIGHT_PX;
  if (mode === 2) return delta * PAGE_HEIGHT_PX;
  return delta;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export { clamp, fanOffset, wheelDeltaToPixels };
