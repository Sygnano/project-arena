import { useEffect, type RefObject } from "react";
import { GESTURE_GAP_MS, canScrollY, wheelDeltaToPixels } from "@/hooks/use-wheel-scrolls-sideways";

/**
 * A vertical wheel anywhere over `areaRef` (a panel) scrolls `listRef` (the
 * panel's one list), not only while the pointer is on the list itself — so
 * a panel whose list sits beside a chart scrolls the list from over the
 * chart too.
 *
 * Same hand-off as the page's `useWheelScrollsSideways`: the list takes the
 * wheel while it has room in that direction, then the page changes section
 * on the next gesture, with the rest of the gesture that reached the list's
 * end absorbed so a flick doesn't run on into the next slide. The page hook
 * skips events this one already took (`defaultPrevented`). Wheels over the
 * list itself scroll it natively and are left to the page hook.
 */
export function useWheelForwardsTo(areaRef: RefObject<HTMLElement | null>, listRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    let lastConsumedAt = -Infinity;

    const onWheel = (event: WheelEvent) => {
      const list = listRef.current;
      if (!list || event.defaultPrevented || event.ctrlKey || event.shiftKey) return;
      if (event.target instanceof Node && list.contains(event.target)) return;
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const px = wheelDeltaToPixels(event.deltaY, event.deltaMode);
      if (px === 0) return;

      if (canScrollY(list, px)) {
        event.preventDefault();
        list.scrollTop += px;
        lastConsumedAt = event.timeStamp;
      } else if (event.timeStamp - lastConsumedAt < GESTURE_GAP_MS) {
        event.preventDefault();
        lastConsumedAt = event.timeStamp;
      }
    };

    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, [areaRef, listRef]);
}
