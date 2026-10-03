import { BAR_WIDTH_EXPONENT } from "./constants";
import type { Metric, Row } from "./types";

function barWidthPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, value / max));
  return ratio ** BAR_WIDTH_EXPONENT * 100;
}

function metricValue(row: Row, metric: Metric): number {
  return metric === "heal" ? row.active.healingAndShielding : row.active.ccScoreSeconds;
}

export { barWidthPercent, metricValue };
