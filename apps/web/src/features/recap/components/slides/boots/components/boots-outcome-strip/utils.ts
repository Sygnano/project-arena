import type { BootsOutcome } from "@arena/types";

function top3Rate(outcome: BootsOutcome): number {
  return outcome.games > 0 ? (outcome.top3Finishes / outcome.games) * 100 : 0;
}

export { top3Rate };
