"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { cn } from "cn";
import type { HoverPoint } from "@/components/hextech-bar-chart";
import { useSectionInView } from "@/hooks/use-section-in-view";
import { TIER_STYLE, type Tier } from "@/lib/tier-bars";

/** Pointy-top hexagon: height = width × 2/√3; rows interlock at a vertical
 * pitch of (width + gap) × √3/2. */
const HEX_HEIGHT_RATIO = 2 / Math.sqrt(3);
const ROW_PITCH_RATIO = Math.sqrt(3) / 2;
const HEX_CLIP = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

const FLOW_GAP = 6;
/** Per-ring step of the entrance ripple, outward from the comb's centre. */
const RIPPLE_STEP_MS = 55;

/** Rim thickness by tier, thicker than the round rings' since a hexagon's
 * slanted edges read thinner at the same width. Unheld cells get a hairline. */
const RIM_WIDTH: Record<Tier, number> = { silver: 2, gold: 3, prismatic: 4 };

export type HexCombCell = {
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
  hoveredId: number | undefined;
  onHover: (id: number | null, point?: HoverPoint) => void;
  /** `useChartHover`'s container, so a tap outside the comb closes the card. */
  hoverRef: RefObject<HTMLDivElement | null>;
  /** Changing it replays the entrance ripple (e.g. on a filter tab switch). */
  animationKey?: string;
  /** Extra classes on each icon, e.g. a zoom for art with built-in padding. */
  imageClassName?: string;
};

/**
 * Honeycomb rows: long and short rows alternate (`columns`, `columns - 1`),
 * each centred, which is what staggers them into a comb. The last row keeps
 * its full slot count and pads with empty slots on both sides, so a short
 * final row still lands on the lattice instead of re-centring off it.
 */
function combRows(count: number, columns: number): number[] {
  const rows: number[] = [];
  let placed = 0;
  while (placed < count) {
    const length = rows.length % 2 === 0 ? columns : Math.max(1, columns - 1);
    rows.push(length);
    placed += length;
  }
  return rows;
}

/**
 * Solves the column count giving the biggest hexagons that fit the parent's
 * box (like `useFitColumns`, but with honeycomb row geometry). Only the deck
 * layout has a fixed height to fit; in flow the section grows to its content,
 * so there the width alone sets the columns.
 */
function useCombLayout<T extends HTMLElement>(
  count: number,
  { gap, minColumns, maxColumns, maxHexWidth, flowHexWidth }: Pick<
    Props,
    "gap" | "minColumns" | "maxColumns" | "maxHexWidth" | "flowHexWidth"
  >,
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

      if (!deck.matches) {
        const columns = Math.min(
          maxColumns,
          Math.max(4, Math.floor((width + FLOW_GAP) / (flowHexWidth + FLOW_GAP))),
        );
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
          (height - (rows - 1) * gap * ROW_PITCH_RATIO) /
          (HEX_HEIGHT_RATIO + (rows - 1) * ROW_PITCH_RATIO);
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
  }, [count, gap, minColumns, maxColumns, maxHexWidth, flowHexWidth]);

  return [ref, layout] as const;
}

/**
 * The Hall of Fame grids (Arena, Augment and Prismatic God) as a honeycomb:
 * each hexagon rimmed by its best-finish tier (the animated `.tier-bar-*`
 * fills), never-played cells greyed out. Cells ripple in from the centre each
 * time the slide is reached. Fills its parent, which should be a flex box
 * with a definite height in the deck layout.
 */
function HexComb({
  cells,
  gap: deckGap,
  minColumns,
  maxColumns,
  maxHexWidth,
  flowHexWidth,
  hoveredId,
  onHover,
  hoverRef,
  animationKey,
  imageClassName,
}: Props) {
  const [combRef, { columns, hexWidth, gap }] = useCombLayout<HTMLDivElement>(
    cells.length,
    { gap: deckGap, minColumns, maxColumns, maxHexWidth, flowHexWidth },
  );
  const [inViewRef, inView] = useSectionInView<HTMLDivElement>();

  const rows = useMemo(() => {
    const lengths = combRows(cells.length, columns);
    const starts = lengths.map((_, i) =>
      lengths.slice(0, i).reduce((sum, length) => sum + length, 0),
    );
    return lengths.map((length, i) => {
      const items = cells.slice(starts[i], starts[i] + length);
      const padBefore = Math.floor((length - items.length) / 2);
      return { length, padBefore, padAfter: length - items.length - padBefore, items };
    });
  }, [cells, columns]);

  const hexHeight = hexWidth * HEX_HEIGHT_RATIO;
  const rowOverlap = hexHeight - (hexWidth + gap) * ROW_PITCH_RATIO;
  const centreRow = (rows.length - 1) / 2;

  const renderCell = (cell: HexCombCell, rowIndex: number, slot: number, rowLength: number) => {
    const { id, tier, interactive } = cell;
    const rim = tier ? RIM_WIDTH[tier] : 1;
    // Hex-ish distance from the comb's centre, for the ripple.
    const dy = Math.abs(rowIndex - centreRow);
    const dx = Math.abs(slot - (rowLength - 1) / 2);
    const ring = Math.round(Math.max(dy, dx + dy / 2));
    const hovered = hoveredId === id;

    return (
      <div
        key={id}
        className={cn(
          "relative flex-none transition-[transform,filter] duration-200 ease-out",
          inView && "hof-cell-in",
          interactive &&
            "hover:z-10 hover:scale-[1.18] hover:brightness-125 focus-visible:z-10 focus-visible:scale-[1.18] focus-visible:outline-none",
          hovered && "z-10 scale-[1.18] brightness-125",
        )}
        style={
          {
            width: hexWidth,
            height: hexHeight,
            "--hof-delay": `${ring * RIPPLE_STEP_MS}ms`,
            // `drop-shadow` (not `box-shadow`) so the glow follows the clipped
            // hexagon instead of its square box.
            filter: tier ? `drop-shadow(${TIER_STYLE[tier].glow})` : undefined,
          } as CSSProperties
        }
        tabIndex={interactive ? 0 : undefined}
        title={interactive ? undefined : cell.name}
        aria-label={cell.name}
        onPointerEnter={interactive ? (e) => onHover(id, { x: e.clientX, y: e.clientY }) : undefined}
        onPointerMove={interactive ? (e) => onHover(id, { x: e.clientX, y: e.clientY }) : undefined}
        onPointerLeave={interactive ? (e) => { if (e.pointerType !== "touch") onHover(null); } : undefined}
        onFocus={interactive ? (e) => {
          // Keyboard focus only: a click also focuses the cell, and would
          // otherwise yank the pointer-following card to the cell's top.
          if (!e.currentTarget.matches(":focus-visible")) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onHover(id, { x: rect.left + rect.width / 2, y: rect.top });
        } : undefined}
        onBlur={interactive ? () => onHover(null) : undefined}
      >
        {/* Rim: the tier's own bar fill, clipped to the hexagon. */}
        <div
          aria-hidden
          className={cn("absolute inset-0", tier ? TIER_STYLE[tier].fillClass : "bg-[rgba(126,138,150,.3)]")}
          style={{ clipPath: HEX_CLIP }}
        />
        <div
          className="absolute overflow-hidden bg-lol-navy-900"
          style={{
            clipPath: HEX_CLIP,
            // A point sits 2/√3 further from the inner hex than a flat side,
            // so the vertical inset is scaled up to keep the rim even.
            inset: `${rim * HEX_HEIGHT_RATIO}px ${rim}px`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            loading="lazy"
            decoding="async"
            src={cell.iconUrl}
            alt=""
            className={cn(
              "size-full max-w-none object-cover",
              !tier && "opacity-30 brightness-[.7] grayscale",
              imageClassName,
            )}
          />
          {/* Glassy top-left sheen, so the cells read as cut gems. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,.18),transparent_38%)]"
          />
        </div>
      </div>
    );
  };

  return (
    <div ref={inViewRef} className="relative flex min-h-0 flex-1 items-center justify-center">
      {/* Soft prismatic bloom behind the comb's centre. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[10%] rounded-full bg-[radial-gradient(closest-side,rgba(185,138,221,.16),rgba(159,189,232,.06)_55%,transparent)] blur-2xl"
      />
      <div
        // No `overflow` here on purpose: a cell's hover scale renders outside
        // the comb box, and any clipping context cuts it off.
        key={animationKey}
        ref={(node) => {
          combRef.current = node;
          hoverRef.current = node;
        }}
        className="relative flex flex-none flex-col items-center"
      >
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex"
            style={{ gap, marginTop: rowIndex === 0 ? 0 : -rowOverlap }}
          >
            {Array.from({ length: row.padBefore }, (_, i) => (
              <div key={`before-${i}`} aria-hidden style={{ width: hexWidth }} />
            ))}
            {row.items.map((cell, i) =>
              renderCell(cell, rowIndex, row.padBefore + i, row.length),
            )}
            {Array.from({ length: row.padAfter }, (_, i) => (
              <div key={`after-${i}`} aria-hidden style={{ width: hexWidth }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { HexComb };
