"use client";

import { useState } from "react";
import { ResponsivePie } from "@nivo/pie";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  /** A literal color, not a CSS variable — nivo writes it straight into an
   * SVG `fill` attribute. */
  color: string;
};

type Props = {
  slices: readonly DonutSlice[];
  /** Formats every number the donut shows: the hole's total, each legend
   * value and the tooltip. */
  format: (value: number) => string;
  /** Small caption under the hole's total while nothing is hovered (e.g.
   * "46.3K / GAME"). */
  caption?: string;
};

/**
 * A small donut + legend showing how one total splits into parts — the
 * champion dossier's stand-in for the page-level sections' stacked bars
 * (damage by type, casts by spell, anvils by tier), sized to sit four
 * across in the dossier's grid.
 *
 * Hovering a slice or its legend row swaps the hole's read-out from the
 * total to that part and its share, same interaction as the Boots donut.
 */
export function CompositionDonut({ slices, format, caption }: Props) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const hovered = slices.find((slice) => slice.key === hoveredKey) ?? null;
  const share = (value: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : "0%");

  return (
    // The legend rides beside the ring once its column is wide enough
    // (`@[13rem]`, ~208px) and stacks under it otherwise — a narrow "four
    // across" column (e.g. the 1280×860 deck-mode floor) doesn't leave
    // enough room beside a 120px ring for the value/share text, which used
    // to spill out over the neighboring donut instead of wrapping. The
    // `@container` lives on its own wrapper — a size-contained element can't
    // also read its own container query.
    <div className="@container min-w-0">
      <div className="flex flex-col items-center gap-2 @[13rem]:flex-row @[13rem]:items-center @[13rem]:gap-5">
        <div className="relative h-30 w-30 flex-none">
          {total > 0 ? (
            <ResponsivePie
              // Zero slices are left out of the arcs (nivo still reserves
              // padding for them) but stay in the legend below.
              data={slices
                .filter((slice) => slice.value > 0)
                .map((slice) => ({
                  id: slice.key,
                  label: slice.label,
                  value: slice.value,
                  color: slice.color,
                }))}
              margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
              innerRadius={0.76}
              padAngle={1.5}
              cornerRadius={1.5}
              activeOuterRadiusOffset={5}
              colors={(datum) => datum.data.color}
              borderWidth={1}
              borderColor="rgba(4,12,20,.85)"
              enableArcLabels={false}
              enableArcLinkLabels={false}
              onMouseEnter={(datum) => setHoveredKey(String(datum.id))}
              onMouseLeave={() => setHoveredKey(null)}
              tooltip={() => null}
            />
          ) : (
            <div className="absolute inset-1.5 rounded-full border-[9px] border-[rgba(200,170,110,.1)]" />
          )}

          {/* The hole's read-out. `pointer-events-none` so it never steals the
            hover it reports on. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="font-display text-[19px] leading-none tabular-nums"
              style={{ color: hovered?.color ?? "var(--color-lol-gold-50)" }}
            >
              {format(hovered ? hovered.value : total)}
            </div>
            <div className="mt-1 text-[11px] tracking-[.06em] text-lol-text-muted sm:whitespace-nowrap">
              {hovered ? share(hovered.value) : (caption ?? "TOTAL")}
            </div>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-0.5 @[13rem]:flex-1">
          {slices.map((slice) => {
            const isHovered = hoveredKey === slice.key;
            return (
              <div
                key={slice.key}
                tabIndex={0}
                aria-label={`${slice.label}: ${format(slice.value)}, ${share(slice.value)}`}
                onMouseEnter={() => setHoveredKey(slice.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(slice.key)}
                onBlur={() => setHoveredKey(null)}
                className="flex items-center gap-2 px-1.5 py-0.5 transition-colors duration-150"
                style={{
                  background: isHovered ? "rgba(200,170,110,.09)" : "transparent",
                  opacity: slice.value > 0 ? 1 : 0.4,
                }}
              >
                <div className="h-1.75 w-1.75 flex-none rotate-45" style={{ background: slice.color }} />
                <span className="flex-1 truncate text-[11px] tracking-[.14em] text-lol-text-muted">{slice.label}</span>
                <span className="font-display text-[14px] tabular-nums" style={{ color: slice.color }}>
                  {format(slice.value)}
                </span>
                <span className="w-8 text-right text-[11px] text-lol-text-muted tabular-nums">
                  {share(slice.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
