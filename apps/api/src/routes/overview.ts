import type { FastifyInstance } from "fastify";
import { matchParticipants, matches, sql, summoners } from "@arena/db";
import { db } from "../db.js";

export type Overview = {
  /** Every Arena match stored, whoever's refresh brought it in. */
  matchCount: number;
  /** Summoners whose page shows a recap: refreshed at least once (by a
   * search or the crawler) and with at least one stored match. Players only
   * discovered in someone else's match don't count until refreshed. */
  recapCount: number;
};

// The splash page asks on every visit; the counts only move when ingestion
// stores something, so a minute of staleness is invisible.
const CACHE_MS = 60_000;
let cached: { at: number; value: Promise<Overview> } | null = null;

async function loadOverview(): Promise<Overview> {
  const [[{ matchCount }], [{ recapCount }]] = await Promise.all([
    db.select({ matchCount: sql<number>`count(*)::int` }).from(matches),
    db
      .select({ recapCount: sql<number>`count(*)::int` })
      .from(summoners)
      .where(
        sql`${summoners.lastRefreshedAt} is not null and exists (
          select 1 from ${matchParticipants} where ${matchParticipants.puuid} = ${summoners.puuid}
        )`,
      ),
  ]);
  return { matchCount, recapCount };
}

export async function overviewRoutes(app: FastifyInstance) {
  app.get("/overview", async () => {
    if (!cached || Date.now() - cached.at > CACHE_MS) {
      const value = loadOverview();
      cached = { at: Date.now(), value };
      // A failed query must not stay cached for the next minute.
      value.catch(() => {
        if (cached?.value === value) cached = null;
      });
    }
    return cached.value;
  });
}
