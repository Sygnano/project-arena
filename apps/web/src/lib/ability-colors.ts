import type { AbilityCastBreakdown } from "@arena/types";

/**
 * The Q / W / E / R cast palette. Started as a local `COLORS` in
 * `modules/Ability.tsx`; pulled out once the champion gallery's dossier
 * needed the same mapping for its ability-casts donut, so a spell keeps one
 * color across the page.
 */
export const ABILITY_COLORS: Record<keyof AbilityCastBreakdown, string> = {
  q: "#0ac8b9",
  w: "#22c55e",
  e: "#c8aa6e",
  r: "#d946ef",
};

/** Draw/read order for the four ability slots. */
export const ABILITY_KEYS = ["q", "w", "e", "r"] as const;
