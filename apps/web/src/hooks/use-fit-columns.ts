import { useLayoutEffect, useRef, useState } from "react";

type Options = {
  /** Gap between cells in px (the `lg:gap-5` the grids use). */
  gap: number;
  min: number;
  max: number;
  /** Column count used before the first measurement (server render). */
  fallback: number;
};

/**
 * Picks a square-cell grid's column count so `count` cells fill the space
 * the grid's parent actually has: the smallest count (biggest icons) whose
 * rows fit the parent's height, else `max`. Re-measures on resize.
 *
 * Replaces column counts tuned against one measured viewport, which gave the
 * wrong density on every other screen size.
 *
 * `rows = ceil(count / columns)` is a step function, so each candidate is
 * simulated rather than solved from a formula.
 *
 * Measured in a layout effect: when `count` changes (a filter tab), a plain
 * effect painted one frame at the old column count before snapping.
 */
export function useFitColumns<T extends HTMLElement>(count: number, { gap, min, max, fallback }: Options) {
  const ref = useRef<T>(null);
  const [columns, setColumns] = useState(fallback);

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const style = getComputedStyle(parent);
      const width = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = parent.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width <= 0 || height <= 0) return;
      let best = max;
      for (let candidate = min; candidate <= max; candidate++) {
        const rows = Math.ceil(count / candidate);
        const cell = (width - (candidate - 1) * gap) / candidate;
        if (rows * cell + (rows - 1) * gap <= height) {
          best = candidate;
          break;
        }
      }
      setColumns(best);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [count, gap, min, max]);

  return [ref, columns] as const;
}
