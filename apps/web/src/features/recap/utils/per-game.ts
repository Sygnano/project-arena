/**
 * Divides every numeric field of a stat breakdown by a game count — the
 * "PER GAME" reading of a totals object (damage by type, casts by spell,
 * utility numbers). Totals mostly measure how often a champion was played;
 * per-game averages are what make champions comparable.
 *
 * Values are rounded to whole numbers except those listed in `keepDecimals`
 * (small per-game figures like saves, where 0.4 matters).
 */
export function perGame<T extends object>(totals: T, games: number, keepDecimals: readonly (keyof T)[] = []): T {
  const result = { ...totals };
  for (const key of Object.keys(totals) as (keyof T)[]) {
    const value = totals[key];
    if (typeof value !== "number") continue;
    const average = games > 0 ? value / games : 0;
    (result[key] as number) = keepDecimals.includes(key) ? Math.round(average * 10) / 10 : Math.round(average);
  }
  return result;
}
