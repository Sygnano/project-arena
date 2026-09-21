"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HoverPoint } from "@/components/hextech-bar-chart";

type Hover<Id> = { id: Id; point: HoverPoint };

/**
 * Hover state for a chart's `CursorTooltip` card: which item is under the
 * pointer (or keyboard focus) and where the card should sit.
 *
 * On touch a tap fires enter and leave together, so charts keep the card
 * open on touch leave (`HextechBarChart` does) and this hook closes it on the
 * next tap outside `containerRef`, or on any scroll.
 */
function useChartHover<Id extends string | number = number>() {
  const [hover, setHover] = useState<Hover<Id> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isHovering = hover !== null;

  useEffect(() => {
    if (!isHovering) return;
    const clearOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setHover(null);
    };
    const clear = () => setHover(null);
    window.addEventListener("pointerdown", clearOutside);
    window.addEventListener("scroll", clear, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", clearOutside);
      window.removeEventListener("scroll", clear, { capture: true });
    };
  }, [isHovering]);

  /** Matches `HextechBarChart`'s `onHover`. */
  const onHover = useCallback((id: string | number | null, point?: HoverPoint) => {
    setHover(id === null || !point ? null : { id: id as Id, point });
  }, []);

  return { hover, setHover, onHover, containerRef };
}

export { useChartHover };
