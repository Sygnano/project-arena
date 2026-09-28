const HEAL_COLOR = "var(--color-lol-heal)";

const CC_COLOR = "#ba00fb";

/** Same fractional-power width scaling as Damage/Ability's row-list bars — a
 * plain linear ratio makes anything short of the leader look
 * disproportionately tiny, so the ratio is raised to a fractional power
 * first: still pins 0 -> 0% and 1 (the leader) -> 100%, but compresses the
 * low end upward so real gaps still read as gaps. Applied independently per
 * side (heal vs CC each scale against their own leader), since the two axes
 * aren't the same unit. */
// Linear (exponent 1): bar length is proportional to the value. An earlier
// 0.55 power drew a third of the leader at ~55% width, which read as a much
// closer race than the numbers are.
const BAR_WIDTH_EXPONENT = 1;

const ROW_GRID = "72px minmax(0,1fr) 96px minmax(0,1fr) 72px";

const COLUMN_GAP = 16;

/** Row height and the list's fixed slot pitch (row height + inter-row gap),
 * in px — same idea as Damage/Ability's identical constants, just shorter
 * since a row here is only a bar + value (no champion name underneath the
 * icon — see the icon layer below). */
const ROW_HEIGHT = 40;

const ROW_GAP = 4;

const SLOT_PITCH = ROW_HEIGHT + ROW_GAP;

const ICON_SIZE = 32;

export { HEAL_COLOR, CC_COLOR, BAR_WIDTH_EXPONENT, ROW_GRID, COLUMN_GAP, ROW_HEIGHT, ROW_GAP, SLOT_PITCH, ICON_SIZE };
