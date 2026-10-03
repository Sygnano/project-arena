import { type RefObject, useEffect, useState } from "react";
import { HIDE_AFTER_PX, REVEAL_ZONE_PX } from "./constants";

/**
 * Hidden while scrolling down, shown again on scroll up or near the top
 * edge; never hidden while the bar holds focus. Listens in the capture phase
 * to catch the recap's own scroll container as well as the page.
 */
function useAutoHide(barRef: RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastTop = 0;
    const onScroll = (event: Event) => {
      const target = event.target;
      const top = target instanceof HTMLElement ? target.scrollTop : (document.scrollingElement?.scrollTop ?? 0);
      const delta = top - lastTop;
      lastTop = top;
      if (barRef.current?.contains(document.activeElement)) return;
      if (top < HIDE_AFTER_PX || delta < -4) setHidden(false);
      else if (delta > 4) setHidden(true);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.clientY < REVEAL_ZONE_PX) setHidden(false);
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [barRef]);

  return [hidden, setHidden] as const;
}

export { useAutoHide };
