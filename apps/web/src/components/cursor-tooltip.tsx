"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { HoverPoint } from "@/components/hextech-bar-chart";

/** Gap between the pointer and the card's nearest corner. */
const OFFSET = 16;
/** Keeps the card clear of the viewport edge. */
const EDGE_MARGIN = 8;

/**
 * A card that follows the pointer, like nivo's chart tooltips (the activity
 * calendar's). Portaled to `body` and `position: fixed`, so a transformed or
 * `overflow-hidden` section ancestor can't clip or offset it. Flips to the
 * pointer's other side instead of running off the right or bottom edge.
 */
function CursorTooltip({
  point,
  children,
}: {
  point: HoverPoint | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const visible = point !== null;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  if (!point || typeof document === "undefined") return null;

  let left = point.x + OFFSET;
  if (left + size.width > window.innerWidth - EDGE_MARGIN) {
    left = point.x - OFFSET - size.width;
  }
  let top = point.y + OFFSET;
  if (top + size.height > window.innerHeight - EDGE_MARGIN) {
    top = point.y - OFFSET - size.height;
  }

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-50"
      style={{
        left: Math.max(EDGE_MARGIN, left),
        top: Math.max(EDGE_MARGIN, top),
        // Hidden for the first frame, until its own size is known.
        visibility: size.width === 0 ? "hidden" : undefined,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export { CursorTooltip };
