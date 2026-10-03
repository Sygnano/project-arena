import { useEffect, useRef } from "react";
import { COLUMN_STAGGER_MS, ENTRANCE_MS, ROW_STAGGER_MS } from "./constants";

function useCellEntrance(enabled: boolean, replayKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;

    let frame = 0;
    // ResponsiveTimeRange measures its container before it draws anything, so
    // on a cold mount the first commit has no cells yet — retry for a few
    // frames rather than silently skipping the animation.
    let attemptsLeft = 20;

    const run = () => {
      const cells = Array.from(root.querySelectorAll<SVGRectElement>("svg rect"));
      if (cells.length === 0) {
        if (attemptsLeft-- > 0) frame = requestAnimationFrame(run);
        return;
      }

      const columns = [...new Set(cells.map((c) => Number(c.getAttribute("x"))))].sort((a, b) => a - b);
      const rows = [...new Set(cells.map((c) => Number(c.getAttribute("y"))))].sort((a, b) => a - b);

      for (const cell of cells) {
        const column = columns.indexOf(Number(cell.getAttribute("x")));
        const row = rows.indexOf(Number(cell.getAttribute("y")));
        cell.animate(
          [
            { opacity: 0, transform: "scale(0.4)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          {
            duration: ENTRANCE_MS,
            delay: column * COLUMN_STAGGER_MS + row * ROW_STAGGER_MS,
            easing: "cubic-bezier(0, 0, 0.58, 1)",
            fill: "backwards",
          },
        );
      }
    };

    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [enabled, replayKey]);

  return containerRef;
}

export { useCellEntrance };
