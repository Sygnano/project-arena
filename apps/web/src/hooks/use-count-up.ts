import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 up to `target` over `durationMs`, ease-out
 * quartic. Re-runs whenever `target` changes. A plain rAF loop rather than
 * a CSS `@property`/`counter()` tween — that CSS-only technique only
 * interpolates integers, which can't produce formatted output like
 * "18h 42m" or a percentage; a JS loop lets the caller format the in-flight
 * value however it needs every frame.
 *
 * Stays at 0 until `enabled` is true (default true) — pair with
 * `useInView` so the count-up starts when the number actually scrolls into
 * view, not the moment it mounts off-screen and finishes before anyone
 * sees it.
 *
 * Under `prefers-reduced-motion: reduce` the target is shown immediately.
 */
export function useCountUp(target: number, durationMs: number, enabled = true): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(undefined);

  useEffect(() => {
    if (!enabled) return;
    const start = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function tick(now: number) {
      const progress = reduceMotion ? 1 : Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) ** 4; // ease-out quartic
      setValue(target * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs, enabled]);

  return value;
}
