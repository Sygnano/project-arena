import { and, asc, gt, isNull, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { summoners } from "./schema.js";

/**
 * A Riot ID's lookup key, `summoners.riot_id_key`: trimmed, Unicode
 * lowercase and NFC-normalized, "gamename#tag". Riot IDs are typed by hand
 * and aren't case-sensitive, and Postgres's `lower()` under this database's
 * C collation only lowercases ASCII (a quarter of stored names aren't), so
 * the key is computed here, the same way for storing and for looking up.
 */
export function riotIdKey(gameName: string, tagLine: string): string {
  const part = (value: string) => value.trim().toLowerCase().normalize("NFC");
  return `${part(gameName)}#${part(tagLine)}`;
}

/** The Riot ID columns of a `summoners` row: names trimmed (match data can
 * carry a trailing space, which made the row unreachable by URL) and the key. */
export function riotIdColumns(gameName: string, tagLine: string) {
  return {
    riotIdGameName: gameName.trim(),
    riotIdTagline: tagLine.trim(),
    riotIdKey: riotIdKey(gameName, tagLine),
  };
}

const BACKFILL_BATCH = 1000;

/**
 * Fills `riot_id_key` (and trims the names) for rows stored before the
 * column existed. Every writer sets it now, so after the first run this
 * finds nothing. Called by the API at startup, right after the migrations.
 * Returns how many rows it filled.
 */
export async function backfillRiotIdKeys(db: Db): Promise<number> {
  let filled = 0;
  let after = "";
  for (;;) {
    const rows = await db
      .select({ puuid: summoners.puuid, gameName: summoners.riotIdGameName, tagLine: summoners.riotIdTagline })
      .from(summoners)
      .where(and(isNull(summoners.riotIdKey), gt(summoners.puuid, after)))
      .orderBy(asc(summoners.puuid))
      .limit(BACKFILL_BATCH);
    if (rows.length === 0) return filled;
    // One statement per batch: a round trip per row would take minutes on a
    // hosted database with hundreds of thousands of summoners.
    const values = sql.join(
      rows.map((row) => {
        const columns = riotIdColumns(row.gameName, row.tagLine);
        return sql`(${row.puuid}, ${columns.riotIdGameName}, ${columns.riotIdTagline}, ${columns.riotIdKey})`;
      }),
      sql`, `,
    );
    await db.execute(sql`
      update summoners set
        riot_id_game_name = v.game_name, riot_id_tagline = v.tag_line, riot_id_key = v.key
      from (values ${values}) as v(puuid, game_name, tag_line, key)
      where summoners.puuid = v.puuid`);
    filled += rows.length;
    after = rows.at(-1)!.puuid;
  }
}
