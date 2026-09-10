import { summoners, type Db } from "@arena/db";
import type { RiotClient } from "../riot/client.js";
import { ingestAllTrackedSummoners } from "./ingestSummoner.js";

/**
 * Polls every tracked summoner on a fixed interval. Deliberately simple
 * (setInterval, no queue) — fits friend-group scale (see CLAUDE.md §3);
 * revisit if the tracked list or match volume grows a lot.
 */
export function startIngestionLoop(db: Db, riot: RiotClient, intervalMinutes: number) {
  const run = async () => {
    const tracked = await db.select({ puuid: summoners.puuid, region: summoners.region }).from(summoners);
    const results = await ingestAllTrackedSummoners(db, riot, tracked);
    const ingestedCount = results.reduce((sum, r) => sum + ("ingested" in r ? r.ingested : 0), 0);
    if (ingestedCount > 0) {
      console.log(`[ingestion] ingested ${ingestedCount} new match(es) across ${tracked.length} summoner(s)`);
    }
  };

  void run();
  const timer = setInterval(run, intervalMinutes * 60_000);
  return () => clearInterval(timer);
}
