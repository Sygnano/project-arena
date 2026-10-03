import type { AbilityCastBreakdown, DamageBreakdown } from "@arena/types";

/** Same two rate colors Champion Picks uses for the identical two figures,
 * so "gold = top 3, prismatic = 1st" stays consistent between the section
 * that ranks champions and the one that drills into them. */
const TOP3_RATE_COLOR = "#e0b563";

const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

const HEAL_COLOR = "var(--color-lol-heal)";

const CC_COLOR = "#ba00fb";

const SPECIAL_COLOR = "var(--color-lol-blue-300)";

/** Literal swatches for the anvil donut — the same three tier colors
 * `tier-bars.ts`'s flat swatches use (nivo needs real colors, not CSS
 * variables). */
const ANVIL_COLORS = {
  stat: "#b9c4c8",
  legendary: "#c89b3c",
  prismatic: "#b98add",
} as const;

const NO_DAMAGE: DamageBreakdown = { physical: 0, magical: 0, trueDamage: 0 };

const NO_CASTS: AbilityCastBreakdown = { q: 0, w: 0, e: 0, r: 0 };

export { ANVIL_COLORS, CC_COLOR, FIRST_RATE_COLOR, HEAL_COLOR, NO_CASTS, NO_DAMAGE, SPECIAL_COLOR, TOP3_RATE_COLOR };
