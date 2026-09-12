/** Abbreviates a large count to the nearest thousand/million (`17400000` ->
 * `"17.4M"`, `1489` -> `"1.5K"`) — used wherever a number needs to fit a
 * narrow label (Damage's header strip and per-champion columns) rather than
 * a full comma-grouped figure. */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

/** Renders a placement number with its English ordinal suffix (`1` ->
 * `"1st"`, `12` -> `"12th"`) — shared by Placement's per-column labels and
 * TimePlayed's per-day "best placement" detail. */
export function ordinal(n: number): string {
  const remainder = n % 100;
  if (remainder >= 11 && remainder <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
