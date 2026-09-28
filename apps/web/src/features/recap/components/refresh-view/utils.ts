import type { RefreshProgress } from "@arena/types";

function formatEta(seconds: number) {
  if (seconds < 60) return "less than a minute left";
  const minutes = Math.round(seconds / 60);
  return `about ${minutes} min left`;
}

type ProgressCopy = {
  eyebrow: string;
  detail: string;
  /** How much of the fetch is done, for the emblem's ring; null before matches are counted. */
  fraction: number | null;
  /** Set while matches are fetched one by one. */
  matches: { done: number; total: number } | null;
};

/** What the queue screen says about a running fetch, stage by stage. */
function describeProgress(progress: RefreshProgress | null, server: string): ProgressCopy {
  const assembling = progress?.state === "done";
  const fetching = progress?.state === "running" && progress.phase === "matches" && progress.total > 0;
  const fraction = assembling ? 1 : fetching ? progress.done / progress.total : null;

  let eyebrow = "SUMMONING";
  let detail = `Looking up this Riot ID on ${server}…`;
  if (assembling) {
    eyebrow = "FORGING YOUR RECAP";
    detail = "Every match is in. Putting the season together…";
  } else if (progress?.state === "queued") {
    eyebrow = "IN QUEUE";
    detail =
      progress.position === 0
        ? "You're next."
        : `${progress.position} ${progress.position === 1 ? "summoner" : "summoners"} ahead of you.`;
  } else if (progress?.state === "running" && progress.waitingOnRiot) {
    // Held at the Riot gateway: behind other requests, or out of Riot budget.
    eyebrow = "WAITING ON RIOT";
    detail = fetching
      ? `Match ${progress.done} of ${progress.total} · Riot is busy, the fetch resumes as soon as it lets us through`
      : "Riot is busy. The fetch resumes as soon as it lets us through…";
  } else if (progress?.state === "running" && !fetching) {
    eyebrow = "SCOUTING MATCH HISTORY";
    detail = "Reading the list of Arena matches from Riot…";
  } else if (fetching) {
    eyebrow = "FETCHING MATCHES";
    detail = `Match ${progress.done} of ${progress.total}${progress.etaSeconds !== null ? ` · ${formatEta(progress.etaSeconds)}` : ""}`;
  }

  return { eyebrow, detail, fraction, matches: fetching ? { done: progress.done, total: progress.total } : null };
}

export { describeProgress, formatEta };
