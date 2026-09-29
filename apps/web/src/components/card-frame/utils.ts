import type { Tier } from "@/utils/tier-bars";

/** Silver stays the non-animated `-static` variant — calmer with several
 * rings/frames on screen at once than a shimmer on every commonly-picked
 * one. */
function frameRingClassName(tier: Tier | null): string {
  if (tier === "prismatic") return "augment-frame augment-frame-prismatic";
  if (tier === "gold") return "augment-frame augment-frame-gold";
  if (tier === "silver") return "augment-frame augment-frame-silver-static";
  return "border grayscale opacity-30 brightness-[.7]";
}

export { frameRingClassName };
