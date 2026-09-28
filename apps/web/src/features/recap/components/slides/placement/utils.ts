import type { Tier } from "@/utils/tier-bars";

function placementTier(placement: number): Tier {
  if (placement === 1) return "prismatic";
  if (placement <= 3) return "gold";
  return "silver";
}

export { placementTier };
