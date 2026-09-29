import type { RefObject } from "react";
import type { HoverPoint } from "@/components/hextech-bar-chart";
import type { Tier } from "@/utils/tier-bars";

type HexCombCell = {
  id: number;
  name: string;
  iconUrl: string;
  /** Best-finish tier (`tierForBestFinish`); `null` greys the cell out. */
  tier: Tier | null;
  /** Has stats for a hover card; the rest only get their name as a title. */
  interactive: boolean;
};

type Layout = { columns: number; hexWidth: number; gap: number };

type Props = {
  cells: HexCombCell[];
  /** Gap between hexagons in the deck layout. */
  gap: number;
  minColumns: number;
  maxColumns: number;
  /** Past this the comb stops growing and just sits centered. */
  maxHexWidth: number;
  /** Target hexagon width in the flow layout, which is fitted to width only. */
  flowHexWidth: number;
  /** Fit the parent's box at every screen size, not only in the deck layout
   * (the story recap's slides never grow to their content). */
  alwaysFit?: boolean;
  /** Drives the entrance ripple from outside instead of scroll position:
   * cells stay hidden while false and ripple in when it turns true (a story
   * slide waits until it has stopped moving). */
  play?: boolean;
  hoveredId: number | undefined;
  onHover: (id: number | null, point?: HoverPoint) => void;
  /** `useChartHover`'s container, so a tap outside the comb closes the card. */
  hoverRef: RefObject<HTMLDivElement | null>;
  /** Changing it replays the entrance ripple (e.g. on a filter tab switch). */
  animationKey?: string;
  /** Extra classes on each icon, e.g. a zoom for art with built-in padding. */
  imageClassName?: string;
};

export type { HexCombCell, Layout, Props };
