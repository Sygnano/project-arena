import type { CalendarStats } from "@arena/types";
import { toLocalHours } from "@/utils/time-zone";

/** The calendar's by-hour arrays re-indexed to the viewer's local hours (the
 * API buckets by UTC hour). Days stay UTC days: the API sends no per-game
 * times to re-bucket them from. */
function localizeCalendarHours(calendar: CalendarStats, offsetHours: number): CalendarStats {
  if (Math.round(offsetHours) === 0) return calendar;
  return {
    ...calendar,
    gamesByHour: toLocalHours(calendar.gamesByHour, offsetHours),
    top1ByHour: toLocalHours(calendar.top1ByHour, offsetHours),
    top3ByHour: toLocalHours(calendar.top3ByHour, offsetHours),
    avgPlacementByHour: toLocalHours(calendar.avgPlacementByHour, offsetHours),
    kdaByHour: toLocalHours(calendar.kdaByHour, offsetHours),
    avgGameSecondsByHour: toLocalHours(calendar.avgGameSecondsByHour, offsetHours),
    championsByHour: toLocalHours(calendar.championsByHour, offsetHours),
  };
}

export { localizeCalendarHours };
