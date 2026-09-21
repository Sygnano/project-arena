import type { DamageBreakdown } from "@arena/types";

/**
 * The physical / magical / true damage palette, shared by every surface that
 * splits damage by type. White for true damage is deliberate — it's the one
 * type with no elemental color of its own in League's own UI, and it reads as
 * "unresisted/raw" against the two colored types.
 *
 * Pulled out of `modules/Damage.tsx` (where it started as a local `COLORS`)
 * once the champion gallery's per-champion dossier needed the identical
 * mapping — same "extract on the second real consumer" rule the rest of
 * `lib/` follows.
 */
export const DAMAGE_TYPE_COLORS: Record<keyof DamageBreakdown, string> = {
  physical: "#ff8c34",
  magical: "#00b0f0",
  trueDamage: "#ffffff",
};

export const DAMAGE_TYPE_LABELS: Record<keyof DamageBreakdown, string> = {
  physical: "PHYSICAL",
  magical: "MAGICAL",
  trueDamage: "TRUE",
};

/** Draw/read order for the three types — physical, magical, then true,
 * matching the order the in-client scoreboard lists them. */
export const DAMAGE_TYPE_KEYS = [
  "physical",
  "magical",
  "trueDamage",
] as const;

export function sumDamageBreakdown(breakdown: DamageBreakdown): number {
  return breakdown.physical + breakdown.magical + breakdown.trueDamage;
}
