/** Abbreviates a large count to the nearest thousand/million (`17400000` ->
 * `"17.4M"`, `1489` -> `"1.5K"`) — used wherever a number needs to fit a
 * narrow label (Damage's header strip and per-champion columns) rather than
 * a full comma-grouped figure. */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

/** Formats a duration given in seconds as `"Xh Ym"` (e.g. `48213` ->
 * `"13h 23m"`) — used wherever a stat is stored as raw seconds (Utility's CC
 * time dealt) but reads better as hours/minutes than a bare number. */
export function formatHoursMinutes(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
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

/** A duration in seconds, adapted to its size: "1h 12m" for an hour or
 * more, "4m 12s" under that, "38s" under a minute. Used for CC time dealt
 * (Riot's `totalTimeCCDealt`) — NOT CC score (`timeCCingOthers`), which despite
 * its field name is a unitless scoreboard figure, not a duration, and is
 * formatted as a plain number (formatCompact) everywhere instead. */
export function formatDuration(seconds: number): string {
  if (seconds >= 3600) return formatHoursMinutes(seconds);
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

/** Gold as "1.23M", "45K" or "820". The unit is chosen from `unitFrom`
 * (default: the value itself), so a count-up animating toward 1.2M stays in
 * "M" the whole way instead of jumping from "K" to "M". */
export function formatGold(value: number, unitFrom = value): string {
  if (unitFrom >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (unitFrom >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return Math.round(value).toLocaleString("en-US");
}
