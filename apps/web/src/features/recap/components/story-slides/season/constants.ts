const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

const DAY_MS = 86_400_000;

/** Month labels closer than this many weeks to the previous one are dropped. */
const MIN_WEEKS_BETWEEN_LABELS = 3;

export { DAY_MS, MIN_WEEKS_BETWEEN_LABELS, MONTH };
