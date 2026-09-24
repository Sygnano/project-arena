import { useEffect } from "react";

/** Wheel deltas arrive in pixels, lines (Firefox mouse wheel) or pages. */
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 400;

/** A wheel gesture that just scrolled a row or list to its end keeps being absorbed
 * until the wheel goes quiet this long, so the rest of the same flick (or a
 * trackpad's momentum) doesn't carry straight on into the next section. */
export const GESTURE_GAP_MS = 200;

export function wheelDeltaToPixels(delta: number, mode: number): number {
  if (mode === 1) return delta * LINE_HEIGHT_PX;
  if (mode === 2) return delta * PAGE_HEIGHT_PX;
  return delta;
}

function canScrollX(el: Element, px: number): boolean {
  const overflowX = getComputedStyle(el).overflowX;
  if (overflowX !== "auto" && overflowX !== "scroll") return false;
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 1) return false;
  return px > 0 ? el.scrollLeft < max - 1 : el.scrollLeft > 1;
}

export function canScrollY(el: Element, px: number): boolean {
  const overflowY = getComputedStyle(el).overflowY;
  if (overflowY !== "auto" && overflowY !== "scroll") return false;
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 1) return false;
  return px > 0 ? el.scrollTop < max - 1 : el.scrollTop > 1;
}

/**
 * A vertical mouse wheel over a horizontally scrollable row (a bar chart with
 * more champions than fit, a wide table panel) scrolls that row sideways
 * first. Once the row reaches its end in the wheel's direction — or when
 * nothing under the pointer overflows — the wheel falls through to the
 * page's scroll container and changes section as usual.
 *
 * Inner vertical lists behave the same way: they keep their native wheel
 * while they have room, and the page takes over at their end on the next
 * gesture. That's why those lists must not set `overscroll-behavior:
 * contain` — it would trap the wheel at the end instead.
 *
 * One delegated listener on the scroll container covers every scroller on
 * the page. Handlers deeper in the tree that already took the event
 * (`CoverflowGallery`) are left alone via `defaultPrevented`.
 */
export function useWheelScrollsSideways(scrollId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.getElementById(scrollId);
    if (!root) return;

    let lastConsumedAt = -Infinity;

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.shiftKey) return;
      // Genuine horizontal gestures (trackpad swipes) scroll natively.
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const px = wheelDeltaToPixels(event.deltaY, event.deltaMode);
      if (px === 0) return;

      for (let el = event.target instanceof Element ? event.target : null; el && el !== root; el = el.parentElement) {
        if (canScrollY(el, px)) {
          // Native scroll; still counts as the gesture that owns the wheel.
          lastConsumedAt = event.timeStamp;
          return;
        }
        if (canScrollX(el, px)) {
          event.preventDefault();
          el.scrollLeft += px;
          lastConsumedAt = event.timeStamp;
          return;
        }
      }

      if (event.timeStamp - lastConsumedAt < GESTURE_GAP_MS) {
        event.preventDefault();
        lastConsumedAt = event.timeStamp;
      }
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [scrollId, enabled]);
}
