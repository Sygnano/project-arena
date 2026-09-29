import { useEffect, useRef } from "react";
import { REARM_MS, START_SWIPE_PX, START_WHEEL_PX } from "./constants";

function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("a, button, input, select, textarea") !== null;
}

/**
 * "Scroll down to start": on the cover, a downward wheel, an upward swipe or
 * ArrowDown / PageDown / Space starts the story, as scrolling would move a
 * page on. Only listens while `enabled` (the cover is showing), and not in
 * the first moments after that.
 */
function useStartGestures(enabled: boolean, onStart: () => void) {
  const startRef = useRef(onStart);
  useEffect(() => {
    startRef.current = onStart;
  });

  useEffect(() => {
    if (!enabled) return;
    const armedAt = performance.now() + REARM_MS;
    const start = () => {
      if (performance.now() >= armedAt) startRef.current();
    };
    let touchY: number | null = null;

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > START_WHEEL_PX) start();
    };
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      if (touchY - y > START_SWIPE_PX) {
        touchY = null;
        start();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isControl(event.target)) return;
      if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        start();
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}

export { useStartGestures };
