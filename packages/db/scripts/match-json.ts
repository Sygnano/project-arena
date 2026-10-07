/**
 * Writes one stored match's decompressed `raw` and `timeline` JSON to files and prints their
 * paths: the way to look at Riot's real payload without calling Riot.
 *
 * `--scrub` replaces every PUUID and player identity (Riot ID, summoner name and id) with a
 * stable placeholder, so the files can be committed as a test fixture: the repository is public,
 * and PUUIDs must never be published. `--brotli` writes them compressed like the database does
 * (`.json.br`, read back with `decompressJson`): the format for fixtures.
 *
 * Usage: pnpm --filter @arena/db match-json <matchId> [outDir] [--scrub] [--brotli]
 *        (outDir defaults to the OS temp directory)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { archivedMatches } from "../src/archiveSchema.js";
import { compressJson, decompressJson } from "../src/compression.js";
import { connectArchive } from "./archived-matches.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const args = process.argv.slice(2);
const scrub = args.includes("--scrub");
const brotli = args.includes("--brotli");
const [matchId, outDir = path.join(os.tmpdir(), "arena-matches")] = args.filter((a) => !a.startsWith("--"));
if (!matchId) throw new Error("Usage: pnpm --filter @arena/db match-json <matchId> [outDir] [--scrub] [--brotli]");

/** Fields naming a player, replaced by `--scrub` (PUUIDs are replaced wherever they appear). */
const IDENTITY_FIELDS = new Set(["riotIdGameName", "riotIdName", "riotIdTagline", "summonerName", "summonerId"]);

function scrubber(puuids: string[]) {
  const aliases = new Map(puuids.map((puuid, i) => [puuid, `puuid-${i + 1}`]));
  const walk = (value: unknown, key?: string, owner?: string): unknown => {
    if (typeof value === "string") {
      if (aliases.has(value)) return aliases.get(value);
      if (key && IDENTITY_FIELDS.has(key)) return key === "riotIdTagline" ? "TEST" : `${key}-${owner ?? "x"}`;
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => walk(item, undefined, owner));
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const id = typeof record.participantId === "number" ? String(record.participantId) : owner;
      return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, walk(v, k, id)]));
    }
    return value;
  };
  return walk;
}

const archive = connectArchive(DATABASE_URL);
const [row] = await archive
  .select({ raw: archivedMatches.raw, timeline: archivedMatches.timeline })
  .from(archivedMatches)
  .where(eq(archivedMatches.matchId, matchId));
if (!row) throw new Error(`No stored match ${matchId}`);

let raw = decompressJson<{ metadata?: { participants?: string[] } }>(row.raw);
let timeline = row.timeline ? decompressJson(row.timeline) : null;
if (scrub) {
  const walk = scrubber(raw.metadata?.participants ?? []);
  raw = walk(raw) as typeof raw;
  timeline = timeline && walk(timeline);
}

async function write(name: string, value: unknown) {
  const file = path.join(outDir, brotli ? `${name}.json.br` : `${name}.json`);
  fs.writeFileSync(file, brotli ? await compressJson(value) : JSON.stringify(value, null, 2));
  console.log(file);
}

fs.mkdirSync(outDir, { recursive: true });
await write(matchId, raw);
if (timeline) {
  await write(`${matchId}.timeline`, timeline);
} else {
  console.log("(no stored timeline)");
}
process.exit(0);
