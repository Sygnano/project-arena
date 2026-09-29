import { DAMAGE_TYPE_COLORS } from "@/features/recap/utils/damage-types";
import type { Metric } from "./types";

const METRICS: Metric[] = ["total", "physical", "magical", "trueDamage"];

const METRIC_LABEL: Record<Metric, string> = {
  total: "TOTAL",
  physical: "PHYSICAL",
  magical: "MAGICAL",
  trueDamage: "TRUE",
};

/** Local alias for the shared palette (see `lib/damage-types.ts`) — kept so
 * this file's many `COLORS.physical` references read unchanged. */
const COLORS = DAMAGE_TYPE_COLORS;

/** Maps a row's value, relative to the top row's, onto a bar width — plain
 * linear scaling (ratio * 100) makes anything short of the leader look
 * disproportionately tiny (a third of the top damage would draw as a
 * 33%-wide bar), so the ratio is raised to a fractional power first: that
 * still pins 0 -> 0% and 1 (the leader) -> 100%, but compresses the low end
 * upward, so real gaps still read as gaps without every non-leader bar
 * looking crushed against the axis. */
// Linear (exponent 1): bar length is proportional to the value. An earlier
// 0.55 power drew a third of the leader at ~55% width, which read as a much
// closer race than the numbers are.
const BAR_WIDTH_EXPONENT = 1;

const BREAKDOWN_KEYS = ["physical", "magical", "trueDamage"] as const;

/** Row height and the list's fixed slot pitch (row height + inter-row gap),
 * in px — matches the row's own `py-1.25` (5px) padding around a 36px icon
 * and the list's `gap-0.75` (3px). Needed as real numbers (not just Tailwind
 * classes) because the icon overlay below is positioned by `index * SLOT_PITCH`
 * rather than participating in normal document flow. */
const ROW_HEIGHT = 46;

const ROW_GAP = 3;

const SLOT_PITCH = ROW_HEIGHT + ROW_GAP;

const ICON_SIZE = 36;

const ROW_PADDING_X = 6;

export {
  METRICS,
  METRIC_LABEL,
  COLORS,
  BAR_WIDTH_EXPONENT,
  BREAKDOWN_KEYS,
  ROW_HEIGHT,
  ROW_GAP,
  SLOT_PITCH,
  ICON_SIZE,
  ROW_PADDING_X,
};
