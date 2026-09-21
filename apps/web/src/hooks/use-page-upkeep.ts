import { useEffect } from "react";

/**
 * Two page-wide chores for the summoner page's scroll container:
 *
 * - Pauses CSS animations (dial spins, ring sheens, breathing diamonds) in
 *   sections more than a screen away, via `data-offscreen` + a rule in
 *   globals.css. Hundreds of rings otherwise animate off screen all the time.
 * - Marks remote images that fail to load (`data-broken`) so they are hidden
 *   instead of showing a broken-image glyph and their alt text, e.g. a
 *   champion newer than the pinned Data Dragon version.
 */
export function usePageUpkeep(scrollId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.getElementById(scrollId);
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.toggleAttribute("data-offscreen", !entry.isIntersecting);
        }
      },
      { root, rootMargin: "100% 0px" },
    );
    for (const section of root.querySelectorAll(":scope > section")) {
      observer.observe(section);
    }

    const markBroken = (event: Event) => {
      if (event.target instanceof HTMLImageElement) {
        event.target.setAttribute("data-broken", "");
      }
    };
    root.addEventListener("error", markBroken, true);
    for (const img of root.querySelectorAll("img")) {
      if (img.complete && img.naturalWidth === 0 && img.src) img.setAttribute("data-broken", "");
    }

    return () => {
      observer.disconnect();
      root.removeEventListener("error", markBroken, true);
    };
  }, [scrollId, enabled]);
}
