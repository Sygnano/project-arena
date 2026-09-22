/**
 * Aggregation helpers for the in-memory stats. They follow SQL's null rules,
 * which the stats were first written against: `sum` counts a null as 0,
 * `avg`/`max`/`min` skip nulls, and an empty input gives 0.
 */

type Value = number | null | undefined;

export function sumOf<T>(rows: readonly T[], get: (row: T) => Value): number {
  let total = 0;
  for (const row of rows) total += get(row) ?? 0;
  return total;
}

export function maxOf<T>(rows: readonly T[], get: (row: T) => Value): number {
  let max: number | null = null;
  for (const row of rows) {
    const value = get(row);
    if (value != null && (max === null || value > max)) max = value;
  }
  return max ?? 0;
}

export function minOf<T>(rows: readonly T[], get: (row: T) => Value): number {
  let min: number | null = null;
  for (const row of rows) {
    const value = get(row);
    if (value != null && (min === null || value < min)) min = value;
  }
  return min ?? 0;
}

export function avgOf<T>(rows: readonly T[], get: (row: T) => Value): number {
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const value = get(row);
    if (value == null) continue;
    total += value;
    count += 1;
  }
  return count > 0 ? total / count : 0;
}

export function countOf<T>(rows: readonly T[], test: (row: T) => boolean): number {
  let count = 0;
  for (const row of rows) if (test(row)) count += 1;
  return count;
}

/** The row with the highest score; the earliest one wins a tie. */
export function maxBy<T>(rows: readonly T[], score: (row: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const row of rows) {
    const value = score(row);
    if (value > bestScore) {
      best = row;
      bestScore = value;
    }
  }
  return best;
}

export function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k);
    if (group) group.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

/** Adds 1 to a counter in a Map. */
export function increment<K>(counts: Map<K, number>, key: K, by = 1) {
  counts.set(key, (counts.get(key) ?? 0) + by);
}

/** (kills + assists) / deaths, or kills + assists with no deaths: Riot's KDA. */
export function kdaRatio(kills: number, deaths: number, assists: number) {
  return deaths === 0 ? kills + assists : (kills + assists) / deaths;
}

/** (kills + assists) / deaths with deaths floored at 1, for grouped KDAs. */
export function flooredKda(kills: number, deaths: number, assists: number) {
  return (kills + assists) / Math.max(1, deaths);
}

/** A result split into 1st place, 2nd-3rd, and the rest. "Win" = top 3. */
export interface PlacementSplit {
  top1: number;
  top3ExclTop1: number;
  remaining: number;
}

export const emptySplit = (): PlacementSplit => ({ top1: 0, top3ExclTop1: 0, remaining: 0 });

export function addToSplit(split: PlacementSplit, placement: number) {
  if (placement === 1) split.top1 += 1;
  else if (placement <= 3) split.top3ExclTop1 += 1;
  else split.remaining += 1;
}

/** Games, 1st places and top 3 finishes. */
export interface WinTally {
  count: number;
  top1: number;
  top3: number;
}

export const emptyTally = (): WinTally => ({ count: 0, top1: 0, top3: 0 });

export function addToTally(tally: WinTally, placement: number) {
  tally.count += 1;
  if (placement === 1) tally.top1 += 1;
  if (placement <= 3) tally.top3 += 1;
}
