/**
 * One-off maintenance script: rewrites every stored PUUID to the one issued
 * to the Riot app behind the current RIOT_API_KEY.
 *
 * PUUIDs are encrypted per Riot application, so switching to a key from a
 * different app makes every stored PUUID undecryptable ("400 Bad Request -
 * Exception decrypting ..."). An old PUUID can't be converted directly, so
 * each player is re-resolved by their latest known Riot ID through
 * account-v1. Players whose Riot ID no longer resolves (renamed since) keep
 * their old PUUID.
 *
 * Two phases:
 *  1. resolve — one account-v1 call per distinct player, paced to the dev
 *     key's 100 req/2min (~95 min for ~4,700 players). Players seen in the
 *     most matches go first. Progress is saved to `.puuid-remap.json` after
 *     every call, so an interrupted run resumes where it stopped.
 *  2. apply — in one transaction, rewrites `summoners.puuid`,
 *     `match_participants.puuid`, and the PUUIDs inside every
 *     `matches.raw`/`matches.timeline` blob (so a later
 *     backfill-reparse-participants doesn't bring the old ones back).
 *
 * Usage:
 *   pnpm --filter @arena/db remap-puuids            # resolve, then apply
 *   pnpm --filter @arena/db remap-puuids --apply    # apply what's resolved so far
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { brotliDecompressSync } from "node:zlib";
import { compressJson } from "../src/compression.js";

const DATABASE_URL = process.env.DATABASE_URL;
const RIOT_API_KEY = process.env.RIOT_API_KEY;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!RIOT_API_KEY) throw new Error("RIOT_API_KEY is required");

const MAP_FILE = fileURLToPath(new URL("../.puuid-remap.json", import.meta.url));
// 100 requests per 120s, with a little headroom.
const REQUEST_INTERVAL_MS = 1300;

// Platform (match id prefix / summoners.region) -> account-v1 routing cluster.
// Account-V1 has no SEA cluster (and answers the same from every cluster),
// so SEA platforms use asia, as in apps/api/src/riotApi/routing.ts.
const REGIONAL_CLUSTER: Record<string, string> = {
  euw1: "europe", eun1: "europe", tr1: "europe", ru: "europe", me1: "europe",
  na1: "americas", br1: "americas", la1: "americas", la2: "americas",
  kr: "asia", jp1: "asia", oc1: "asia", sg2: "asia", tw2: "asia", vn2: "asia",
};

/** old puuid -> new puuid, or null when the Riot ID no longer resolves. */
type RemapFile = Record<string, string | null>;

const sql = postgres(DATABASE_URL);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadMap(): RemapFile {
  return existsSync(MAP_FILE) ? JSON.parse(readFileSync(MAP_FILE, "utf-8")) : {};
}

async function resolveAccount(cluster: string, gameName: string, tagLine: string) {
  const url = `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  while (true) {
    const res = await fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY! } });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 10);
      console.log(`  rate limited, waiting ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`account-v1 ${res.status} for ${gameName}#${tagLine}: ${await res.text()}`);
    return ((await res.json()) as { puuid: string }).puuid;
  }
}

async function resolve(map: RemapFile) {
  // Latest known Riot ID per player, most-seen players first. Tracked
  // summoners come from `summoners` so they're covered even with no matches.
  const players = await sql<{ puuid: string; gameName: string; tagLine: string; platform: string; games: number; tracked: boolean }[]>`
    with latest as (
      select distinct on (mp.puuid) mp.puuid, mp.riot_id_game_name as "gameName",
        mp.riot_id_tagline as "tagLine", lower(split_part(mp.match_id, '_', 1)) as platform
      from match_participants mp join matches m on m.match_id = mp.match_id
      where mp.riot_id_game_name is not null and mp.riot_id_game_name <> ''
      order by mp.puuid, m.game_creation desc
    ), counts as (
      select puuid, count(*)::int as games from match_participants group by puuid
    )
    select s.puuid, s.riot_id_game_name as "gameName", s.riot_id_tagline as "tagLine",
      lower(s.region) as platform, 0 as games, true as tracked
    from summoners s
    union all
    select l.*, c.games, false as tracked from latest l join counts c using (puuid)
    where l.puuid not in (select puuid from summoners)
    order by tracked desc, games desc`;

  // Values too: after an apply, remapped players already carry their new PUUID.
  const done = new Set([...Object.keys(map), ...Object.values(map)]);
  const todo = players.filter((p) => !done.has(p.puuid));
  console.log(`${players.length} players, ${players.length - todo.length} already resolved, ${todo.length} to go (~${Math.ceil((todo.length * REQUEST_INTERVAL_MS) / 60000)} min)`);

  for (const [i, p] of todo.entries()) {
    const cluster = REGIONAL_CLUSTER[p.platform];
    if (!cluster) throw new Error(`Unknown platform "${p.platform}" — add it to REGIONAL_CLUSTER`);
    const started = Date.now();
    map[p.puuid] = await resolveAccount(cluster, p.gameName, p.tagLine);
    writeFileSync(MAP_FILE, JSON.stringify(map));
    if ((i + 1) % 50 === 0 || i === todo.length - 1) {
      console.log(`  ${i + 1}/${todo.length} (last: ${p.gameName}#${p.tagLine}, ${p.tracked ? "tracked" : `${p.games} games`})`);
    }
    await sleep(Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - started)));
  }
}

async function apply(map: RemapFile) {
  // A Riot ID can pass to someone else after a rename, so two old PUUIDs
  // could resolve to the same account. Drop those rather than merge two
  // different players (or collide on match_participants' primary key).
  const byNew = new Map<string, string[]>();
  for (const [oldId, newId] of Object.entries(map)) {
    if (newId && newId !== oldId) byNew.set(newId, [...(byNew.get(newId) ?? []), oldId]);
  }
  const pairs = [...byNew].filter(([, olds]) => olds.length === 1).map(([newId, [oldId]]) => [oldId!, newId] as const);
  const collisions = [...byNew.values()].filter((olds) => olds.length > 1).length;
  const unresolved = Object.values(map).filter((v) => v === null).length;
  console.log(`Applying ${pairs.length} remaps (${unresolved} unresolved, ${collisions} ambiguous — both kept as-is)`);
  if (pairs.length === 0) return;

  const remap = new Map(pairs);
  // PUUIDs are 78-char base64url strings; rewrite any JSON string that is one we remap.
  const rewrite = (buf: Buffer) => {
    const text = brotliDecompressSync(buf).toString("utf-8");
    return compressJson(JSON.parse(text.replace(/"([A-Za-z0-9_-]{60,100})"/g, (m, id) => (remap.has(id) ? `"${remap.get(id)}"` : m))));
  };

  await sql.begin(async (tx) => {
    await tx`create temp table puuid_remap (old_puuid text primary key, new_puuid text not null) on commit drop`;
    await tx`insert into puuid_remap select * from unnest(${pairs.map((p) => p[0])}::text[], ${pairs.map((p) => p[1])}::text[])`;
    const s = await tx`update summoners s set puuid = r.new_puuid from puuid_remap r where s.puuid = r.old_puuid`;
    const mp = await tx`update match_participants mp set puuid = r.new_puuid from puuid_remap r where mp.puuid = r.old_puuid`;
    console.log(`  summoners: ${s.count}, match_participants: ${mp.count}`);

    const rows = await tx<{ matchId: string; raw: Buffer; timeline: Buffer | null }[]>`
      select match_id as "matchId", raw, timeline from matches`;
    for (const row of rows) {
      await tx`update matches set raw = ${rewrite(row.raw)}, timeline = ${row.timeline ? rewrite(row.timeline) : null}
        where match_id = ${row.matchId}`;
    }
    console.log(`  matches blobs rewritten: ${rows.length}`);
  });
}

async function main() {
  const map = loadMap();
  if (!process.argv.includes("--apply")) await resolve(map);
  await apply(map);
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
