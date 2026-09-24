import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * True while the returned ref's element covers the middle of the summoner
 * page's scroll container (`#summoner-scroll`), or of the viewport when there
 * is no such container.
 *
 * Distinct from the two other visibility hooks here, both of which are
 * one-shot: `useInView` (a number starts counting up the first time it is
 * seen) and `useNearViewport` (background art starts loading a screen early).
 * This one tracks the element's current state and flips back to false as it
 * leaves, so a section's entrance animation replays each time it is scrolled
 * back to — what the deck layout wants, where a section is a slide you scroll
 * away from and return to. The middle-band `rootMargin` (rather than a
 * `threshold`) makes it behave the same for a short section and for one
 * taller than the viewport.
 *
 * Reports true from the start, and never observes anything, under
 * `prefers-reduced-motion` — a reveal built on it then renders plainly rather
 * than being stuck invisible.
 */
export function useSectionInView<T extends Element>() {
  const ref = useRef<T>(null);
  const reduceMotion = useReducedMotion();
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const root = document.getElementById("summoner-scroll");
    const observer = new IntersectionObserver(([entry]) => setIsIntersecting(entry.isIntersecting), {
      root,
      rootMargin: "-20% 0px -20% 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return [ref, isIntersecting || reduceMotion === true] as const;
}
