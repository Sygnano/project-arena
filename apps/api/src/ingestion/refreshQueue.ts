import type { Db } from "@arena/db";
import type { RiotClient } from "../riot/client.js";
import { ingestSummoner } from "./ingestSummoner.js";

type Priority = "user" | "background";

type Job = {
  puuid: string;
  region: string;
  priority: Priority;
  state: "queued" | "running" | "done" | "failed";
  phase: "matchIds" | "matches" | null;
  done: number;
  total: number;
  error: string | null;
  finishedAt: number | null;
};

/** What `GET .../status` reports about a summoner's refresh. */
export type RefreshJobView = {
  state: Job["state"];
  /** Jobs that run before this one (0 once it's running). */
  position: number;
  phase: Job["phase"];
  done: number;
  total: number;
  /** Rough seconds left for a running match fetch, null otherwise. */
  etaSeconds: number | null;
  error: string | null;
};

// Each match costs two Riot calls (match + timeline) and a dev key sustains
// 100 calls per 2 minutes, so a long fetch settles at ~2.4s per match.
// Deliberately the sustained rate, not the 20/s burst: it only overestimates
// when few matches are left and the 2-minute window is still fresh.
const SECONDS_PER_MATCH = (2 * 120) / 100;
// Finished jobs stay visible so a page polling the status sees "done"
// instead of the job vanishing.
const FINISHED_JOB_TTL_MS = 10 * 60_000;

/**
 * The one place the API process runs Riot ingestion from: every refresh (a
 * search, refresh or "fetch matches" press from the web app) goes through this
 * queue, one summoner at a time, because they all share one rate limiter
 * anyway. Searches (`user`) always run before `background` refreshes, so a
 * visitor never waits behind bulk work; nothing enqueues `background` since
 * the poll loop was removed (kept for a future in-process auto-crawler —
 * bulk ingestion runs from `scripts/crawl.ts` for now, a separate process
 * with its own rate limiter). In memory: a restart drops the queue, and
 * the next search simply re-enqueues (ingestion skips matches already
 * stored).
 */
export class RefreshQueue {
  private jobs = new Map<string, Job>();
  private pending: string[] = [];
  private running = false;

  constructor(
    private readonly db: Db,
    private readonly riot: RiotClient,
  ) {}

  enqueue(summoner: { puuid: string; region: string }, priority: Priority) {
    const existing = this.jobs.get(summoner.puuid);
    if (existing && (existing.state === "queued" || existing.state === "running")) {
      if (existing.state === "queued" && priority === "user" && existing.priority === "background") {
        existing.priority = "user";
        this.sortPending();
      }
      return;
    }
    this.jobs.set(summoner.puuid, {
      puuid: summoner.puuid,
      region: summoner.region,
      priority,
      state: "queued",
      phase: null,
      done: 0,
      total: 0,
      error: null,
      finishedAt: null,
    });
    this.pending.push(summoner.puuid);
    this.sortPending();
    void this.drain();
  }

  /** Jobs waiting behind the one running. */
  waitingCount() {
    return this.pending.length;
  }

  isActive(puuid: string) {
    const state = this.jobs.get(puuid)?.state;
    return state === "queued" || state === "running";
  }

  view(puuid: string): RefreshJobView | null {
    this.prune();
    const job = this.jobs.get(puuid);
    if (!job) return null;
    const queuedIndex = this.pending.indexOf(puuid);
    const position =
      job.state === "queued" ? queuedIndex + (this.running ? 1 : 0) : 0;
    const remaining = job.total - job.done;
    return {
      state: job.state,
      position,
      phase: job.phase,
      done: job.done,
      total: job.total,
      etaSeconds:
        job.state === "running" && job.phase === "matches"
          ? Math.ceil(remaining * SECONDS_PER_MATCH)
          : null,
      error: job.error,
    };
  }

  private sortPending() {
    // Stable: keeps arrival order within each priority.
    const rank = (puuid: string) => (this.jobs.get(puuid)?.priority === "user" ? 0 : 1);
    this.pending.sort((a, b) => rank(a) - rank(b));
  }

  private prune() {
    const now = Date.now();
    for (const [puuid, job] of this.jobs) {
      if (job.finishedAt !== null && now - job.finishedAt > FINISHED_JOB_TTL_MS) {
        this.jobs.delete(puuid);
      }
    }
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length > 0) {
        const job = this.jobs.get(this.pending.shift()!);
        if (!job) continue;
        job.state = "running";
        try {
          const { ingested } = await ingestSummoner(this.db, this.riot, job, (progress) => {
            job.phase = progress.phase;
            if (progress.phase === "matches") {
              job.done = progress.done;
              job.total = progress.total;
            }
          });
          job.state = "done";
          if (ingested > 0) {
            console.log(`[ingestion] ${job.puuid}: ${ingested} new match(es) (${job.priority})`);
          }
        } catch (err) {
          job.state = "failed";
          job.error = err instanceof Error ? err.message : String(err);
          console.error(`[ingestion] ${job.puuid} failed: ${job.error}`);
        }
        job.finishedAt = Date.now();
      }
    } finally {
      this.running = false;
    }
  }
}
