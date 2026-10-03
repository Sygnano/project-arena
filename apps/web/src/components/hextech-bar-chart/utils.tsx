import type { BarColumn, BarSegment } from "./types";

/** One soft halo for a whole bar, tinted by its topmost segment's edge color
 * and kept faint on purpose — a strong colored glow on every bar of a dense
 * chart turned the plot into a haze. Only the highlighted bar glows harder. */
function barGlow(column: BarColumn, highlighted: boolean): string | undefined {
  const top = column.segments.find((segment) => segment.height > 0);
  if (!top?.borderColor) return undefined;
  if (highlighted) {
    return `0 0 22px color-mix(in srgb, ${top.borderColor} 55%, transparent), 0 0 6px color-mix(in srgb, ${top.borderColor} 45%, transparent)`;
  }
  if (!top.fillClassName) return undefined;
  return `0 0 14px color-mix(in srgb, ${top.borderColor} 18%, transparent)`;
}

function segmentShadow(segment: BarSegment): string | undefined {
  return segment.fillClassName ? undefined : segment.boxShadow;
}

function renderSegmentLabel(segment: BarSegment, minHeightForLabel: number) {
  return segment.label && segment.height >= minHeightForLabel ? (
    <span className="font-display text-[12px] leading-none text-[#0a1118]/85">{segment.label}</span>
  ) : null;
}

export { barGlow, renderSegmentLabel, segmentShadow };
