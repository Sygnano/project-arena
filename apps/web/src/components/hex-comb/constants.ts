import type { Tier } from "@/utils/tier-bars";

/** Pointy-top hexagon: height = width × 2/√3; rows interlock at a vertical
 * pitch of (width + gap) × √3/2. */
const HEX_HEIGHT_RATIO = 2 / Math.sqrt(3);

const ROW_PITCH_RATIO = Math.sqrt(3) / 2;

const HEX_CLIP = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

const FLOW_GAP = 6;

/** Per-ring step of the entrance ripple, outward from the comb's centre. */
const RIPPLE_STEP_MS = 55;

/** Rim thickness by tier, thicker than the round rings' since a hexagon's
 * slanted edges read thinner at the same width. Unheld cells get a hairline. */
const RIM_WIDTH: Record<Tier, number> = { silver: 2, gold: 3, prismatic: 4 };

export { FLOW_GAP, HEX_CLIP, HEX_HEIGHT_RATIO, RIM_WIDTH, RIPPLE_STEP_MS, ROW_PITCH_RATIO };
