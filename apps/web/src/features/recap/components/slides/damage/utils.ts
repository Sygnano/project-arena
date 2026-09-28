import type { DamageBreakdown } from "@arena/types";
import { BAR_WIDTH_EXPONENT, BREAKDOWN_KEYS } from "./constants";
import type { Metric, Row } from "./types";

function sumBreakdown(breakdown: DamageBreakdown): number {
  return breakdown.physical + breakdown.magical + breakdown.trueDamage;
}

function barWidthPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, value / max));
  return Math.pow(ratio, BAR_WIDTH_EXPONENT) * 100;
}

function columnValue(row: Row, metric: Metric): number {
  return metric === "total" ? sumBreakdown(row.active) : row.active[metric];
}

/** The stacked bar's segment draw order — normally physical/magical/true,
 * but when sorting by one of those specifically, that type's segment leads
 * (leftmost) so the bar visually reads left-to-right in the same order the
 * list is sorted by. */
function segmentOrder(metric: Metric): readonly (typeof BREAKDOWN_KEYS)[number][] {
  if (metric === "total") return BREAKDOWN_KEYS;
  return [metric, ...BREAKDOWN_KEYS.filter((k) => k !== metric)];
}

export { sumBreakdown, barWidthPercent, columnValue, segmentOrder };
