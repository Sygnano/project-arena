import type { CalendarStats } from "@arena/types";

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** The earliest tracked match day (`YYYY-MM-DD`, UTC), or null with no games. */
function firstTrackedDate(calendar: CalendarStats): string | null {
  return calendar.days.reduce<string | null>((min, day) => (min === null || day.date < min ? day.date : min), null);
}

/** The season's years and date span, from the first to the last tracked
 * game: `{ years: "2026", span: "12 MAR – 18 SEP 2026" }`, or a two-year
 * `"2025–26"` when the tracked period crosses New Year. */
function seasonPeriod(firstDay: string, lastMatchAt: string) {
  const start = new Date(`${firstDay}T00:00:00Z`);
  const end = new Date(lastMatchAt);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const sameYear = startYear === endYear;
  return {
    years: sameYear ? String(endYear) : `${startYear}–${String(endYear).slice(-2)}`,
    span: `${(sameYear ? DAY_MONTH : DAY_MONTH_YEAR).format(start)} – ${DAY_MONTH_YEAR.format(end)}`.toUpperCase(),
  };
}

export { firstTrackedDate, seasonPeriod };
