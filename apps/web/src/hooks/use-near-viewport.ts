import { useEffect, useRef, useState } from "react";

/**
 * True once the returned ref's element comes within about one screen of the
 * visible area of the summoner page's scroll container (`#summoner-scroll`),
 * or of the viewport when there is no such container. One-shot: it never
 * flips back to false.
 *
 * Used to defer loading section background art. All ~30 sections are
 * mounted at once, and a CSS `background-image` downloads as soon as its
 * element renders, whether or not it's on screen — so every photo used to
 * download on first load.
 */
export function useNearViewport<T extends Element>(enabled = true) {
  const ref = useRef<T>(null);
  const [isNear, setIsNear] = useState(!enabled);

  useEffect(() => {
    const el = ref.current;
    if (!el || isNear) return;
    const root = document.getElementById("summoner-scroll");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsNear(true);
      },
      { root, rootMargin: "100% 0px 100% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isNear]);

  return [ref, isNear] as const;
}
