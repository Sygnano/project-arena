import type { DamageCurve, DamageCurveSeries } from "@arena/types";
import { DAMAGE_TYPE_KEYS } from "@/features/recap/utils/damage-types";

/** Cumulative damage per minute, every type summed, divided by `games`. */
function totalCurve(series: DamageCurveSeries, games = 1): number[] {
  const length = series.physical.length;
  return Array.from(
    { length },
    (_, minute) => DAMAGE_TYPE_KEYS.reduce((sum, key) => sum + (series[key][minute] ?? 0), 0) / games,
  );
}

/** The average game's and the best game's damage curves. */
function damageLines(curve: DamageCurve) {
  return { average: totalCurve(curve.total, curve.games), best: totalCurve(curve.bestGame.series) };
}

export { damageLines };
