import type { CalendarDayStats } from "@arena/types";
import { DAY_MS, MIN_WEEKS_BETWEEN_LABELS } from "./constants";

type SeasonWeek = {
  /** Month (0-11) to label above this column, when one starts here. */
  monthStart: number | null;
  /** Monday to Sunday: the day's stats, null for a day without games, or
   * undefined outside the season (before its first game, after its last). */
  days: (CalendarDayStats | null | undefined)[];
};

/** The season's days as Monday-first week columns, first game to last (UTC). */
function seasonWeeks(days: CalendarDayStats[]): SeasonWeek[] {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((day) => [day.date, day]));
  const dates = [...byDate.keys()].sort();
  const first = Date.parse(`${dates[0]}T00:00:00Z`);
  const last = Date.parse(`${dates[dates.length - 1]}T00:00:00Z`);
  const mondayOffset = (new Date(first).getUTCDay() + 6) % 7;

  const weeks: SeasonWeek[] = [];
  let labelledMonth = -1;
  let labelledAt = -Infinity;
  for (let weekStart = first - mondayOffset * DAY_MS; weekStart <= last; weekStart += 7 * DAY_MS) {
    const week: SeasonWeek["days"] = [];
    for (let offset = 0; offset < 7; offset++) {
      const time = weekStart + offset * DAY_MS;
      week.push(
        time < first || time > last ? undefined : (byDate.get(new Date(time).toISOString().slice(0, 10)) ?? null),
      );
    }
    const month = new Date(Math.max(weekStart, first)).getUTCMonth();
    const label = month !== labelledMonth && weeks.length - labelledAt >= MIN_WEEKS_BETWEEN_LABELS;
    if (label) {
      labelledMonth = month;
      labelledAt = weeks.length;
    }
    weeks.push({ monthStart: label ? month : null, days: week });
  }
  return weeks;
}

/** Puts a season's playtime in perspective: whole days past two, films below. */
function playtimeComparison(seconds: number): string {
  const days = seconds / 86_400;
  if (days >= 2) return `${Math.floor(days)} whole days`;
  const films = Math.max(1, Math.round(seconds / 7_200));
  return films === 1 ? "about one movie" : `about ${films} movies back to back`;
}

export { playtimeComparison, seasonWeeks };
