/**
 * The one small-sample rule for every rate shown on the summoner page.
 *
 * A rate from a handful of games is mostly noise: one game on a champion,
 * won, is a "100% 1st rate" that would otherwise top every "best X" ranking.
 * Rows below `MIN_SAMPLE` still show, but rate sorts rank them after every
 * row that meets it (unless the viewer mixes them in), and callers dim them — the
 * same treatment the Vault section already used.
 */
export const MIN_SAMPLE = 5;

export function isLowSample(count: number): boolean {
  return count < MIN_SAMPLE;
}

/**
 * Sorts by `rate` (descending, or ascending with `dir: "asc"`), with rows
 * below `MIN_SAMPLE` placed after every eligible row and ordered by the same
 * rate among themselves. Ties on rate break toward the larger sample.
 *
 * `lowSample: "mixed"` sorts every row together as if there were no minimum
 * (callers still dim them) — the `LowSampleSwitch` toggle.
 */
export function sortByRate<T>(
  rows: readonly T[],
  rate: (row: T) => number,
  count: (row: T) => number,
  dir: "asc" | "desc" = "desc",
  lowSample: "after" | "mixed" = "after",
): T[] {
  const sign = dir === "desc" ? 1 : -1;
  const byRate = (a: T, b: T) => sign * (rate(b) - rate(a)) || count(b) - count(a);
  if (lowSample === "mixed") return [...rows].sort(byRate);
  return [
    ...rows.filter((row) => !isLowSample(count(row))).sort(byRate),
    ...rows.filter((row) => isLowSample(count(row))).sort(byRate),
  ];
}

/**
 * The rate across every pick in a list, weighting each row by its sample:
 * `sum(hits) / sum(count)`. This is the fair baseline for augments and items.
 *
 * Longer games hold more augments and build more items, and longer games
 * finish higher: verified on real data, games with 6 augments finished top 3
 * 71% of the time vs 16% with 3, and 1st-place games averaged 16.8 purchased
 * items vs 4.9 for 6th. So nearly every augment or item "beats" the plain
 * per-game rate; comparing to the average pick removes that shared lift.
 */
export function pooledRate<T>(rows: readonly T[], hits: (row: T) => number, count: (row: T) => number): number {
  const total = rows.reduce((sum, row) => sum + count(row), 0);
  return total > 0 ? (rows.reduce((sum, row) => sum + hits(row), 0) / total) * 100 : 0;
}
