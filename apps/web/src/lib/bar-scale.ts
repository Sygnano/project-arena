/**
 * Maps a value to a `HextechBarChart` segment height, LINEARLY from a zero
 * baseline: a bar at half the leader's height means half the leader's value.
 *
 * This replaced an earlier log scale (log, then raised to 1.6). The log
 * scale kept the long tail visible, but with no axis on these charts it
 * silently distorted every comparison — a champion with a third of the
 * leader's kills drew at ~85% of its height. Exact values are always
 * labeled above each bar, so honest proportions win over tail legibility;
 * `minHeight` still keeps a tiny non-zero value from vanishing entirely.
 */
export function barHeight(value: number, hi: number, maxHeight: number, minHeight: number): number {
  if (hi <= 0 || value <= 0) return value > 0 ? minHeight : 0;
  return Math.max(minHeight, (Math.min(value, hi) / hi) * maxHeight);
}
