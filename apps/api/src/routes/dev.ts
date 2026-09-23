import type { FastifyInstance } from "fastify";
import { desc, isNotNull, sql, summoners } from "@arena/db";
import type { DevSummonerList } from "@arena/types";
import { db } from "../db.js";
import { isPlatform, matchRegion, toPlatform } from "../riotApi/routing.js";

// The crawler refreshes thousands of summoners; the page is for checking
// recent ones, so it shows the latest this many.
const MAX_ROWS = 500;

/**
 * Debug reads for the web app's /dev page. Public like everything else here
 * (no auth in v1), database only.
 */
export async function devRoutes(app: FastifyInstance) {
  app.get("/dev/summoners", async (): Promise<DevSummonerList> => {
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          gameName: summoners.riotIdGameName,
          tagLine: summoners.riotIdTagline,
          platform: summoners.region,
          lastRefreshedAt: summoners.lastRefreshedAt,
          // One index lookup per row (match_participants_puuid_idx), on the
          // listed rows only. Written out with table names: drizzle leaves
          // them off a single-table select's columns, which made both sides
          // `"puuid"` (the subquery's own) and counted every row.
          matchCount: sql<number>`(select count(*) from match_participants mp where mp.puuid = summoners.puuid)::int`,
        })
        .from(summoners)
        .where(isNotNull(summoners.lastRefreshedAt))
        .orderBy(desc(summoners.lastRefreshedAt))
        .limit(MAX_ROWS),
      db.select({ total: sql<number>`count(*)::int` }).from(summoners).where(isNotNull(summoners.lastRefreshedAt)),
    ]);
    return {
      total,
      summoners: rows.map(({ lastRefreshedAt, ...row }) => ({
        ...row,
        region: isPlatform(row.platform) ? matchRegion(toPlatform(row.platform)) : "unknown",
        lastRefreshedAt: lastRefreshedAt!.toISOString(),
      })),
    };
  });
}
