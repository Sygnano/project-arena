import { useEffect, useRef, useState } from "react";

/**
 * True once the returned ref's element has intersected the viewport.
 * Triggers once and stops observing — this is meant for one-shot "reveal"
 * effects (like a count-up animation), not a live visibility tracker.
 */
export function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || isInView) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsInView(true);
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
    // `options` is typically a fresh object literal per render — keying off
    // it would tear down and recreate the observer on every render instead
    // of once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView]);

  return [ref, isInView] as const;
}
