import { useLayoutEffect, useRef, useState } from "react";
import { FLOW_GAP, HEX_HEIGHT_RATIO, ROW_PITCH_RATIO } from "./constants";
import type { Layout, Props } from "./types";
import { combRows } from "./utils";

/**
 * Solves the column count giving the biggest hexagons that fit the parent's
 * box (like `useFitColumns`, but with honeycomb row geometry). Only the deck
 * layout has a fixed height to fit; in flow the section grows to its content,
 * so there the width alone sets the columns (unless `alwaysFit`).
 */
function useCombLayout<T extends HTMLElement>(
  count: number,
  {
    gap,
    minColumns,
    maxColumns,
    maxHexWidth,
    flowHexWidth,
    alwaysFit = false,
  }: Pick<Props, "gap" | "minColumns" | "maxColumns" | "maxHexWidth" | "flowHexWidth" | "alwaysFit">,
) {
  const ref = useRef<T>(null);
  const [layout, setLayout] = useState<Layout>({
    columns: minColumns,
    hexWidth: flowHexWidth,
    gap,
  });

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const deck = window.matchMedia("(min-width: 1280px) and (min-height: 860px)");
    const measure = () => {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (width <= 0) return;

      if (!deck.matches && !alwaysFit) {
        const columns = Math.min(maxColumns, Math.max(4, Math.floor((width + FLOW_GAP) / (flowHexWidth + FLOW_GAP))));
        setLayout({
          columns,
          gap: FLOW_GAP,
          hexWidth: (width - (columns - 1) * FLOW_GAP) / columns,
        });
        return;
      }

      let best: Layout = { columns: maxColumns, hexWidth: 0, gap };
      for (let columns = minColumns; columns <= maxColumns; columns++) {
        const rows = combRows(count, columns).length;
        const byWidth = (width - (columns - 1) * gap) / columns;
        const byHeight =
          (height - (rows - 1) * gap * ROW_PITCH_RATIO) / (HEX_HEIGHT_RATIO + (rows - 1) * ROW_PITCH_RATIO);
        const hexWidth = Math.min(byWidth, byHeight, maxHexWidth);
        if (hexWidth > best.hexWidth) best = { columns, hexWidth, gap };
      }
      if (best.hexWidth > 0) setLayout(best);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    deck.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      deck.removeEventListener("change", measure);
    };
  }, [count, gap, minColumns, maxColumns, maxHexWidth, flowHexWidth, alwaysFit]);

  return [ref, layout] as const;
}

export { useCombLayout };
