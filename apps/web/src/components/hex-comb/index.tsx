"use client";

import { useMemo, type CSSProperties } from "react";
import { cn } from "cn";
import { useSectionInView } from "@/hooks/use-section-in-view";
import { TIER_STYLE } from "@/utils/tier-bars";
import { HEX_CLIP, HEX_HEIGHT_RATIO, RIM_WIDTH, RIPPLE_STEP_MS, ROW_PITCH_RATIO } from "./constants";
import { useCombLayout } from "./hooks";
import type { HexCombCell, Props } from "./types";
import { combRows } from "./utils";

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
  alwaysFit,
  play,
}: Props) {
  const [combRef, { columns, hexWidth, gap }] = useCombLayout<HTMLDivElement>(cells.length, {
    gap: deckGap,
    minColumns,
    maxColumns,
    maxHexWidth,
    flowHexWidth,
    alwaysFit,
  });
  const [inViewRef, scrolledTo] = useSectionInView<HTMLDivElement>();
  const inView = play ?? scrolledTo;

  const rows = useMemo(() => {
    const lengths = combRows(cells.length, columns);
    const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, length) => sum + length, 0));
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
          play === false && "opacity-0",
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
        onPointerLeave={
          interactive
            ? (e) => {
                if (e.pointerType !== "touch") onHover(null);
              }
            : undefined
        }
        onFocus={
          interactive
            ? (e) => {
                // Keyboard focus only: a click also focuses the cell, and would
                // otherwise yank the pointer-following card to the cell's top.
                if (!e.currentTarget.matches(":focus-visible")) return;
                const rect = e.currentTarget.getBoundingClientRect();
                onHover(id, { x: rect.left + rect.width / 2, y: rect.top });
              }
            : undefined
        }
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
          <div key={rowIndex} className="flex" style={{ gap, marginTop: rowIndex === 0 ? 0 : -rowOverlap }}>
            {Array.from({ length: row.padBefore }, (_, i) => (
              <div key={`before-${i}`} aria-hidden style={{ width: hexWidth }} />
            ))}
            {row.items.map((cell, i) => renderCell(cell, rowIndex, row.padBefore + i, row.length))}
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
export type { HexCombCell } from "./types";
