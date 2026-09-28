import type { RefreshProgress } from "@arena/types";

function progressLabel(progress: RefreshProgress | null) {
  if (progress?.state === "queued") {
    return progress.position === 0 ? "UPDATING · NEXT IN QUEUE" : `UPDATING · ${progress.position} AHEAD IN QUEUE`;
  }
  if (progress?.state === "running" && progress.waitingOnRiot) return "UPDATING · WAITING ON RIOT";
  if (progress?.state === "running" && progress.phase === "matches" && progress.total > 0) {
    return `UPDATING · MATCH ${progress.done} OF ${progress.total}`;
  }
  return "UPDATING";
}

export { progressLabel };
