import { ABILITY_COLORS } from "@/features/recap/utils/ability-colors";
import type { Metric } from "./types";

const METRICS: Metric[] = ["total", "q", "w", "e", "r"];

const METRIC_LABEL: Record<Metric, string> = {
  total: "TOTAL",
  q: "Q",
  w: "W",
  e: "E",
  r: "R",
};

const COLORS = ABILITY_COLORS;

/** Same easing as Damage's identical helper — a plain linear ratio makes
 * anything short of the leader look disproportionately tiny, so the ratio is
 * raised to a fractional power first: still pins 0 -> 0% and 1 (the leader)
 * -> 100%, but compresses the low end upward so real gaps still read as gaps
 * without every non-leader bar looking crushed against the axis. */
// Linear (exponent 1): bar length is proportional to the value. An earlier
// 0.55 power drew a third of the leader at ~55% width, which read as a much
// closer race than the numbers are.
const BAR_WIDTH_EXPONENT = 1;

const BREAKDOWN_KEYS = ["q", "w", "e", "r"] as const;

/** Row height and the list's fixed slot pitch (row height + inter-row gap),
 * in px — matches Damage's identical layout constants. */
const ROW_HEIGHT = 46;

const ROW_GAP = 3;

const SLOT_PITCH = ROW_HEIGHT + ROW_GAP;

const ICON_SIZE = 36;

const ROW_PADDING_X = 6;

export {
  BAR_WIDTH_EXPONENT,
  BREAKDOWN_KEYS,
  COLORS,
  ICON_SIZE,
  METRIC_LABEL,
  METRICS,
  ROW_GAP,
  ROW_HEIGHT,
  ROW_PADDING_X,
  SLOT_PITCH,
};
