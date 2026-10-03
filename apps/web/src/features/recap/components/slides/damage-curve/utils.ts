import type { DamageCurve as Curve, DamageCurveSeries } from "@arena/types";
import { formatCompact } from "@/utils/format";
import type { DamageCurvePoint, Findings, Mode } from "./types";

/** The API sends one array per damage type (index = minute); the chart
 * reads a point per minute. `divisor` turns TOTAL into AVERAGE. */
function toPoints(series: DamageCurveSeries, divisor = 1): DamageCurvePoint[] {
  return series.physical.map((physical, minute) => ({
    minute,
    physical: physical / divisor,
    magical: (series.magical[minute] ?? 0) / divisor,
    trueDamage: (series.trueDamage[minute] ?? 0) / divisor,
  }));
}

function pointTotal(point: DamageCurvePoint): number {
  return point.physical + point.magical + point.trueDamage;
}

/** Rounded first: average-mode values are fractional. */
function formatDamage(value: number): string {
  return formatCompact(Math.round(value));
}

function formatMinutes(minutes: number): string {
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return seconds === 60 ? `${whole + 1}:00` : `${whole}:${String(seconds).padStart(2, "0")}`;
}

function findings(points: readonly DamageCurvePoint[]): Findings {
  const totals = points.map(pointTotal);
  const final = totals[totals.length - 1] ?? 0;
  let halfMinute = 0;
  for (let i = 1; i < totals.length; i++) {
    if (totals[i] >= final / 2) {
      const previous = totals[i - 1];
      const step = totals[i] - previous;
      halfMinute = i - 1 + (step > 0 ? (final / 2 - previous) / step : 0);
      break;
    }
  }
  let peak = { minute: 0, dealt: 0 };
  for (let i = 1; i < totals.length; i++) {
    const dealt = totals[i] - totals[i - 1];
    if (dealt > peak.dealt) peak = { minute: i, dealt };
  }
  const at = (minute: number) => totals[Math.min(minute, totals.length - 1)] ?? 0;
  return { final, halfMinute, byMinute10: at(10), byMinute20: at(20), peak };
}

/** The damage the champion list shows on the right and sorts by: the
 * curve's final value in the active mode. */
function curveDamage(curve: Curve, mode: Mode): number {
  const series = mode === "best" ? curve.bestGame.series : curve.total;
  const last = series.physical.length - 1;
  if (last < 0) return 0;
  const total = series.physical[last] + series.magical[last] + series.trueDamage[last];
  return mode === "average" ? total / curve.games : total;
}

export { curveDamage, findings, formatDamage, formatMinutes, pointTotal, toPoints };
