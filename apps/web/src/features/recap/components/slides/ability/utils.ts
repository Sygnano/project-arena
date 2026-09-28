import type { AbilityCastBreakdown } from "@arena/types";
import { BAR_WIDTH_EXPONENT, BREAKDOWN_KEYS } from "./constants";
import type { Metric, Row, SpellKey } from "./types";

function sumBreakdown(breakdown: AbilityCastBreakdown): number {
  return breakdown.q + breakdown.w + breakdown.e + breakdown.r;
}

function barWidthPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, value / max));
  return Math.pow(ratio, BAR_WIDTH_EXPONENT) * 100;
}

function columnValue(row: Row, metric: Metric): number {
  return metric === "total" ? sumBreakdown(row.active) : row.activeByType[metric];
}

/** The stacked bar's segment draw order — normally Q/W/E/R, but when sorting
 * by one of those specifically, that spell's segment leads (leftmost) so the
 * bar visually reads left-to-right in the same order the list is sorted by. */
function segmentOrder(metric: Metric): readonly SpellKey[] {
  if (metric === "total") return BREAKDOWN_KEYS;
  return [metric, ...BREAKDOWN_KEYS.filter((k) => k !== metric)];
}

export { sumBreakdown, barWidthPercent, columnValue, segmentOrder };
