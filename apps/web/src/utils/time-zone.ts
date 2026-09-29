/**
 * Re-indexes 24 values bucketed by UTC hour (index 0 = 00:00-00:59 UTC) by
 * the viewer's local hour instead. Offsets that aren't whole hours (India's
 * +5:30) move by the nearest whole hour: hourly buckets can't be split.
 */
export function toLocalHours<T>(byUtcHour: readonly T[], offsetHours: number): T[] {
  const shift = Math.round(offsetHours);
  return byUtcHour.map((_, localHour) => byUtcHour[(((localHour - shift) % 24) + 24) % 24]);
}

/** "UTC", "UTC+2", "UTC−5", "UTC+5:30": the zone an hour chart is shown in. */
export function utcOffsetLabel(offsetHours: number): string {
  if (offsetHours === 0) return "UTC";
  const sign = offsetHours > 0 ? "+" : "−";
  const hours = Math.floor(Math.abs(offsetHours));
  const minutes = Math.round((Math.abs(offsetHours) - hours) * 60);
  return `UTC${sign}${hours}${minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}
