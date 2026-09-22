import type { Db } from "@arena/db";
import type { RefreshProgress } from "@arena/types";
import { logger } from "../logger.js";
import type { RiotClient } from "../riotApi/client.js";
import { REGION_LABEL, matchRegion, toPlatform, type Region } from "../riotApi/routing.js";
import { ingestSummoner } from "./ingestSummoner.js";

type Priority = "user" | "background";

/** A summoner whose matches to fetch. `label` ("Name#TAG") is for logs. */
export interface RefreshTarget {
  puuid: string;
  /** Their platform (`euw1`), which decides their lane. */
  region: string;
  label: string;
}

type Job = RefreshTarget & {
  lane: Region;
  priority: Priority;
  state: RefreshProgress["state"];
  phase: RefreshProgress["phase"];
  done: number;
  total: number;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
};

/** One regional cluster's line: its waiting jobs and whether one is running. */
interface Lane {
  pending: string[];
  running: boolean;
}

type Listener = (progress: RefreshProgress) => void;

// Each match costs two Riot calls (match + timeline) and a dev key sustains
// 100 calls per 2 minutes, so a long fetch settles at ~2.4s per match.
// Deliberately the sustained rate, not the 20/s burst: it only overestimates
// when few matches are left and the 2-minute window is still fresh.
const SECONDS_PER_MATCH = (2 * 120) / 100;
// Finished jobs stay readable for a while, so a page opened right after a
// fetch still sees how it ended.
const FINISHED_JOB_TTL_MS = 10 * 60_000;

const log = logger.child({ module: "queue" });

/** The cluster a summoner's match fetch runs against (Match-V5 routing). */
export function laneOf(platform: string): Region {
  return matchRegion(toPlatform(platform));
}

/**
 * The one place the API process fetches matches from Riot, with one lane per
 * Riot regional cluster (europe, americas, asia, sea). Riot's rate limits are
 * per cluster, so a fetch on NA never waits behind one on EUW, while EUW and
 * EUNE share a lane because they share the `europe` budget (two lanes there
 * would only compete for it). Within a lane, one summoner at a time, and
 * `user` jobs (a refresh someone is watching) before `background` ones (none
 * today: bulk ingestion is `scripts/crawl.ts`, its own process).
 *
 * In memory: a restart drops the queue and the next refresh press queues
 * again (ingestion skips matches already stored). Anyone can follow a job
 * with `subscribe` (the refresh stream does): its position in its lane, then
 * match by match.
 */
export class RefreshQueue {
  private jobs = new Map<string, Job>();
  private lanes = new Map<Region, Lane>();
  private listeners = new Map<string, Set<Listener>>();

  constructor(
    private readonly db: Db,
    private readonly riot: RiotClient,
  ) {}

  private lane(region: Region): Lane {
    let lane = this.lanes.get(region);
    if (!lane) this.lanes.set(region, (lane = { pending: [], running: false }));
    return lane;
  }

  /** Queues a fetch, unless one is already queued or running for this summoner. */
  enqueue(target: RefreshTarget, priority: Priority) {
    const existing = this.jobs.get(target.puuid);
    if (existing && this.isActiveJob(existing)) {
      if (existing.state === "queued" && priority === "user" && existing.priority === "background") {
        existing.priority = "user";
        this.sortPending(existing.lane);
        this.notifyQueued(existing.lane);
      }
      return;
    }
    const laneName = laneOf(target.region);
    this.jobs.set(target.puuid, {
      ...target,
      lane: laneName,
      priority,
      state: "queued",
      phase: null,
      done: 0,
      total: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
    });
    this.lane(laneName).pending.push(target.puuid);
    this.sortPending(laneName);
    log.info(
      { summoner: target.label, lane: REGION_LABEL[laneName], position: this.progress(target.puuid)?.position },
      "fetch queued",
    );
    this.notify(target.puuid);
    void this.drain(laneName);
  }

  /** Jobs waiting in a platform's lane, behind the one running there. */
  waitingCount(platform: string) {
    return this.lane(laneOf(platform)).pending.length;
  }

  isActive(puuid: string) {
    const job = this.jobs.get(puuid);
    return job !== undefined && this.isActiveJob(job);
  }

  /** The job's progress, or null when there's none (or it ended a while ago). */
  progress(puuid: string): RefreshProgress | null {
    this.prune();
    const job = this.jobs.get(puuid);
    if (!job) return null;
    const lane = this.lane(job.lane);
    const position = job.state === "queued" ? lane.pending.indexOf(puuid) + (lane.running ? 1 : 0) : 0;
    return {
      state: job.state,
      position,
      phase: job.phase,
      done: job.done,
      total: job.total,
      etaSeconds:
        job.state === "running" && job.phase === "matches" ? Math.ceil((job.total - job.done) * SECONDS_PER_MATCH) : null,
      error: job.error,
    };
  }

  /** Calls `listener` on every change to this summoner's job. Returns the unsubscribe. */
  subscribe(puuid: string, listener: Listener): () => void {
    let set = this.listeners.get(puuid);
    if (!set) this.listeners.set(puuid, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(puuid);
    };
  }

  private isActiveJob(job: Job) {
    return job.state === "queued" || job.state === "running";
  }

  private notify(puuid: string) {
    const set = this.listeners.get(puuid);
    if (!set) return;
    const progress = this.progress(puuid);
    if (!progress) return;
    for (const listener of set) listener(progress);
  }

  /** Every waiting job's position moves when its lane does. */
  private notifyQueued(laneName: Region) {
    for (const puuid of this.lane(laneName).pending) this.notify(puuid);
  }

  private sortPending(laneName: Region) {
    // Stable: keeps arrival order within each priority.
    const rank = (puuid: string) => (this.jobs.get(puuid)?.priority === "user" ? 0 : 1);
    this.lane(laneName).pending.sort((a, b) => rank(a) - rank(b));
  }

  private prune() {
    const now = Date.now();
    for (const [puuid, job] of this.jobs) {
      if (job.finishedAt !== null && now - job.finishedAt > FINISHED_JOB_TTL_MS) this.jobs.delete(puuid);
    }
  }

  /** Runs a lane's jobs one after another until it's empty. Lanes run side by side. */
  private async drain(laneName: Region) {
    const lane = this.lane(laneName);
    if (lane.running) return;
    lane.running = true;
    try {
      while (lane.pending.length > 0) {
        const job = this.jobs.get(lane.pending.shift()!);
        if (!job) continue;
        await this.run(job);
      }
    } finally {
      lane.running = false;
    }
  }

  private async run(job: Job) {
    job.state = "running";
    job.startedAt = Date.now();
    const lane = REGION_LABEL[job.lane];
    log.info({ summoner: job.label, lane, waiting: this.lane(job.lane).pending.length }, "fetch started");
    this.notify(job.puuid);
    this.notifyQueued(job.lane);
    try {
      const { ingested } = await ingestSummoner(this.db, this.riot, job, (progress) => {
        job.phase = progress.phase;
        if (progress.phase === "matches") {
          job.done = progress.done;
          job.total = progress.total;
        }
        this.notify(job.puuid);
      });
      job.state = "done";
      log.info(
        { summoner: job.label, lane, newMatches: ingested, seconds: Math.round((Date.now() - job.startedAt) / 1000) },
        "fetch finished",
      );
    } catch (err) {
      job.state = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      log.error({ summoner: job.label, lane, err }, "fetch failed");
    }
    job.finishedAt = Date.now();
    this.notify(job.puuid);
  }
}
