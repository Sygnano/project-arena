/**
 * One-off migration: copies the hosted (Railway) database 1:1 into the local `arena`
 * (DATABASE_URL), every table and column, in primary-key batches, so a dropped connection costs
 * one batch and a restart resumes after the last batch that landed. Reshaping it (the raw data
 * split, the optimizations in docs/database-optimization.md) comes after, locally.
 *
 * Each batch is a binary `COPY` from the source piped into a `COPY` on the target, so values move
 * byte for byte with no parsing. A batch and its resume point (`pull_progress`, the batch's last
 * key in the source's order) commit in one transaction, so a batch lands whole or not at all.
 * Tables are created with their primary key only; `--finish` adds the other indexes and the
 * foreign keys once everything is in.
 *
 * Batches walk the primary key, so a row the source inserts below the cursor during the run is
 * missed: a later delta pass has to compare id sets before the cutover.
 *
 * Usage (from packages/db):
 *   SOURCE_DATABASE_URL=postgres://... pnpm pull-from-railway [--tunnel] [--only <job>]
 *   pnpm pull-from-railway --finish
 *
 * `--tunnel` runs `railway connect postgres --tunnel-only` itself (SOURCE_DATABASE_URL must point at
 * its local port) and restarts it whenever a batch fails, since a dropped SSH tunnel doesn't come
 * back on its own.
 */
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import postgres from "postgres";

const SOURCE_DATABASE_URL = process.env.SOURCE_DATABASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const args = process.argv.slice(2);
const useTunnel = args.includes("--tunnel");
const finishOnly = args.includes("--finish");
const onlyJob = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;

const MAX_CONSECUTIVE_FAILURES = 20;

interface Job {
  name: string;
  /** Source table (schema-qualified). */
  table: string;
  /** Primary key columns, in index order: the batch cursor. */
  key: string[];
  /** Columns copied, in the same order on both sides. */
  columns: string[];
  /** Rows per batch: about 10-40 MB each. */
  batch: number;
}

const PARTICIPANT_COLUMNS = [
  "match_id",
  "puuid",
  "riot_id_game_name",
  "riot_id_tagline",
  "team_id",
  "placement",
  "champion_id",
  "champion_name",
  "augments",
  "items",
  "kills",
  "deaths",
  "assists",
  "gold_earned",
  "damage_dealt_to_champions",
  "time_played_seconds",
  "damage_dealt_to_champions_physical",
  "damage_dealt_to_champions_magic",
  "damage_dealt_to_champions_true",
  "damage_taken_physical",
  "damage_taken_magic",
  "damage_taken_true",
  "largest_critical_strike",
  "healing_and_shielding",
  "cc_score_seconds",
  "cc_total_time_dealt",
  "fist_bumps",
  "q_casts",
  "w_casts",
  "e_casts",
  "r_casts",
  "summoner_spell_1_casts",
  "summoner_spell_2_casts",
  "pings",
  "damage_self_mitigated",
  "double_kills",
  "triple_kills",
  "quadra_kills",
  "penta_kills",
  "largest_killing_spree",
  "first_blood_kill",
  "first_blood_assist",
  "items_purchased",
  "consumables_purchased",
  "solo_kills",
  "skillshots_hit",
  "skillshots_dodged",
  "flawless_aces",
  "save_ally_from_death",
  "frames",
  "stat_anvils_bought",
  "legendary_anvils_bought",
  "prismatic_anvils_bought",
  "boots_bought",
  "boots_sold",
  "purchased_item_ids",
  "summoner_spell_1_id",
  "summoner_spell_2_id",
];

// Smallest first; `matches` (65 GB of blobs) last.
const JOBS: Job[] = [
  {
    name: "migrations",
    table: "drizzle.__drizzle_migrations",
    key: ["id"],
    columns: ["id", "hash", "created_at"],
    batch: 1000,
  },
  {
    name: "bad_matches",
    table: "public.bad_matches",
    key: ["match_id"],
    columns: ["match_id", "platform", "end_of_game_result", "seen_in_puuid", "found_at"],
    batch: 50_000,
  },
  {
    name: "skipped_matches",
    table: "public.skipped_matches",
    key: ["match_id"],
    columns: [
      "match_id",
      "platform",
      "stage",
      "riot_status",
      "error",
      "seen_in_puuid",
      "first_skipped_at",
      "last_skipped_at",
      "times_skipped",
    ],
    batch: 50_000,
  },
  {
    name: "summoners",
    table: "public.summoners",
    key: ["puuid"],
    columns: [
      "puuid",
      "riot_id_game_name",
      "riot_id_tagline",
      "riot_id_key",
      "region",
      "profile_icon_id",
      "summoner_level",
      "last_refreshed_at",
    ],
    batch: 100_000,
  },
  {
    name: "match_rounds",
    table: "public.match_rounds",
    key: ["match_id", "round_number", "winner_team_id"],
    columns: ["match_id", "round_number", "winner_team_id", "loser_team_id"],
    batch: 500_000,
  },
  {
    name: "match_participants",
    table: "public.match_participants",
    key: ["match_id", "puuid"],
    columns: PARTICIPANT_COLUMNS,
    batch: 20_000,
  },
  {
    name: "matches",
    table: "public.matches",
    key: ["match_id"],
    columns: ["match_id", "region", "game_creation", "raw", "timeline", "banned_champion_ids"],
    batch: 300,
  },
];

const ARENA_DDL = `
-- This script's resume points (see copyBatch). Dropped once the pull is verified.
create table if not exists pull_progress (job text primary key, last_key jsonb not null, rows bigint not null default 0);
create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);
create table if not exists bad_matches (
  match_id text primary key,
  platform text not null,
  end_of_game_result text not null,
  seen_in_puuid text not null,
  found_at timestamptz not null default now()
);
create table if not exists skipped_matches (
  match_id text primary key,
  platform text not null,
  stage text not null,
  riot_status integer,
  error text not null,
  seen_in_puuid text not null,
  first_skipped_at timestamptz not null default now(),
  last_skipped_at timestamptz not null default now(),
  times_skipped integer not null default 1
);
create table if not exists summoners (
  puuid text primary key,
  riot_id_game_name text not null,
  riot_id_tagline text not null,
  riot_id_key text,
  region text not null,
  profile_icon_id integer,
  summoner_level integer,
  last_refreshed_at timestamptz
);
create table if not exists matches (
  match_id text primary key,
  region text not null,
  game_creation timestamptz not null,
  raw bytea not null,
  timeline bytea,
  banned_champion_ids integer[]
);
create table if not exists match_rounds (
  match_id text not null,
  round_number smallint not null,
  winner_team_id integer not null,
  loser_team_id integer not null,
  constraint match_rounds_match_id_round_number_winner_team_id_pk primary key (match_id, round_number, winner_team_id)
);
create table if not exists match_participants (
  match_id text not null,
  puuid text not null,
  riot_id_game_name text,
  riot_id_tagline text,
  team_id integer not null,
  placement smallint not null,
  champion_id integer not null,
  champion_name text not null,
  augments jsonb not null,
  items jsonb not null,
  kills integer not null,
  deaths integer not null,
  assists integer not null,
  gold_earned integer not null,
  damage_dealt_to_champions integer not null,
  time_played_seconds integer,
  damage_dealt_to_champions_physical integer,
  damage_dealt_to_champions_magic integer,
  damage_dealt_to_champions_true integer,
  damage_taken_physical integer,
  damage_taken_magic integer,
  damage_taken_true integer,
  largest_critical_strike integer,
  healing_and_shielding integer,
  cc_score_seconds integer,
  cc_total_time_dealt integer,
  fist_bumps integer,
  q_casts integer,
  w_casts integer,
  e_casts integer,
  r_casts integer,
  summoner_spell_1_casts integer,
  summoner_spell_2_casts integer,
  pings smallint[],
  damage_self_mitigated integer,
  double_kills integer,
  triple_kills integer,
  quadra_kills integer,
  penta_kills integer,
  largest_killing_spree integer,
  first_blood_kill boolean,
  first_blood_assist boolean,
  items_purchased integer,
  consumables_purchased integer,
  solo_kills integer,
  skillshots_hit integer,
  skillshots_dodged integer,
  flawless_aces integer,
  save_ally_from_death integer,
  frames jsonb,
  stat_anvils_bought integer,
  legendary_anvils_bought integer,
  prismatic_anvils_bought integer,
  boots_bought jsonb,
  boots_sold jsonb,
  purchased_item_ids jsonb,
  summoner_spell_1_id integer,
  summoner_spell_2_id integer,
  constraint match_participants_match_id_puuid_pk primary key (match_id, puuid)
);
`;

// What Railway has beyond the primary keys. Built once after the load: cheaper than maintaining
// them row by row, and the foreign keys would reject participants copied before their match.
const ARENA_FINISH_DDL = `
select setval('drizzle.__drizzle_migrations_id_seq', coalesce((select max(id) from drizzle.__drizzle_migrations), 1));
create index if not exists match_participants_puuid_idx on match_participants (puuid);
create index if not exists summoners_last_refreshed_at_idx on summoners (last_refreshed_at nulls first);
create index if not exists summoners_riot_id_idx on summoners (region, riot_id_key);
alter table match_participants add constraint match_participants_match_id_matches_match_id_fk
  foreign key (match_id) references matches (match_id) on delete cascade;
alter table match_rounds add constraint match_rounds_match_id_matches_match_id_fk
  foreign key (match_id) references matches (match_id) on delete cascade;
analyze;
`;

function log(message: string) {
  console.log(`${new Date().toISOString()} ${message}`);
}

/** COPY takes no bind parameters, so key values are inlined as literals. They are match ids,
 * PUUIDs and integers read back from the database, never user input. */
function literal(value: unknown): string {
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  throw new Error(`Unexpected key value: ${String(value)}`);
}

function keyTuple(job: Job): string {
  return `(${job.key.join(", ")})`;
}

function valueTuple(job: Job, row: Record<string, unknown>): string {
  return `(${job.key.map((column) => literal(row[column])).join(", ")})`;
}

// --- Railway tunnel ---------------------------------------------------------------------------

let tunnel: ChildProcess | undefined;

function stopTunnel() {
  if (!tunnel?.pid) return;
  // The CLI runs ssh.exe as a child, which outlives a plain kill and keeps holding the port.
  spawnSync("taskkill", ["/PID", String(tunnel.pid), "/T", "/F"], { stdio: "ignore" });
  tunnel = undefined;
}

async function startTunnel() {
  stopTunnel();
  const port = new URL(SOURCE_DATABASE_URL ?? "").port;
  log(`starting railway tunnel on port ${port}`);
  const child = spawn(`railway connect postgres --tunnel-only --port ${port}`, {
    // `railway link` was run at the repository root.
    cwd: new URL("../../..", import.meta.url),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  tunnel = child;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("railway tunnel did not open within 60 s")), 60_000);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes("tunnel open")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`railway tunnel exited with code ${code}`));
    });
  });
  log("railway tunnel open");
}

// --- Copy -------------------------------------------------------------------------------------

function connect(url: string) {
  return postgres(url, { max: 1, onnotice: () => {}, connection: { application_name: "pull-from-railway" } });
}

type Sql = ReturnType<typeof connect>;

/** Copies the next batch after the job's saved cursor. Returns the rows copied (0 once done).
 *
 * The cursor is kept in `pull_progress`, in the source's key order, and never re-derived from the
 * local rows: the two servers' text collations sort differently (Railway's glibc locale against
 * this machine's), so "the highest local key" isn't the source's last copied key. The rows and
 * the new cursor commit in one transaction. */
async function copyBatch(source: Sql, local: Sql, job: Job): Promise<number> {
  const [progress] = await local`select last_key from pull_progress where job = ${job.name}`;
  const cursor = progress?.last_key as Record<string, unknown> | undefined;
  const after = cursor ? `${keyTuple(job)} > ${valueTuple(job, cursor)}` : "true";
  const keys = job.key.join(", ");

  // The batch's last key: an index-only walk of the primary key, no row data read. Short of a
  // full batch, the source's highest key (a backward walk of the same index).
  const [full] = await source.unsafe(
    `select ${keys} from ${job.table} where ${after} order by ${keys} offset ${job.batch - 1} limit 1`,
  );
  const [last] = full
    ? [full]
    : await source.unsafe(
        `select ${keys} from ${job.table} where ${after} order by ${job.key.join(" desc, ")} desc limit 1`,
      );
  if (!last) return 0;
  const range = `${after} and ${keyTuple(job)} <= ${valueTuple(job, last)}`;
  const rows = full
    ? job.batch
    : Number((await source.unsafe(`select count(*) as n from ${job.table} where ${range}`))[0]?.n ?? 0);

  const columns = job.columns.join(", ");
  const lastKey = Object.fromEntries(job.key.map((column) => [column, last[column]]));
  await local.begin(async (tx) => {
    const reader = await source
      .unsafe(`copy (select ${columns} from ${job.table} where ${range}) to stdout (format binary)`)
      .readable();
    const writer = await tx.unsafe(`copy ${job.table} (${columns}) from stdin (format binary)`).writable();
    await pipeline(reader, writer);
    await tx`insert into pull_progress (job, last_key, rows) values (${job.name}, ${tx.json(lastKey)}, ${rows})
      on conflict (job) do update set last_key = excluded.last_key, rows = pull_progress.rows + excluded.rows`;
  });
  return rows;
}

async function estimatedRows(source: Sql, table: string): Promise<number> {
  const [row] = await source.unsafe(
    `select greatest(reltuples, 0)::bigint as n from pg_class where oid = '${table}'::regclass`,
  );
  return Number(row?.n ?? 0);
}

async function runJob(job: Job) {
  if (!SOURCE_DATABASE_URL) throw new Error("SOURCE_DATABASE_URL is required");
  const targetUrl = DATABASE_URL;
  let source = connect(SOURCE_DATABASE_URL);
  let local = connect(targetUrl as string);
  let failures = 0;
  let copied = 0;
  let total = 0;
  const started = Date.now();

  try {
    total = await estimatedRows(source, job.table);
    log(`${job.name}: ~${total.toLocaleString("en")} rows on the source`);
    for (;;) {
      try {
        const rows = await copyBatch(source, local, job);
        failures = 0;
        copied += rows;
        const minutes = (Date.now() - started) / 60_000;
        log(
          `${job.name}: +${rows.toLocaleString("en")} (${copied.toLocaleString("en")} this run, ~${total.toLocaleString("en")} total, ${minutes.toFixed(1)} min)`,
        );
        if (rows < job.batch) break;
      } catch (error) {
        failures += 1;
        log(`${job.name}: batch failed (${failures}/${MAX_CONSECUTIVE_FAILURES}): ${(error as Error).message}`);
        if (failures >= MAX_CONSECUTIVE_FAILURES) throw error;
        await Promise.allSettled([source.end({ timeout: 1 }), local.end({ timeout: 1 })]);
        await new Promise((resolve) => setTimeout(resolve, Math.min(5_000 * failures, 60_000)));
        if (useTunnel) await startTunnel().catch((tunnelError: Error) => log(`tunnel: ${tunnelError.message}`));
        source = connect(SOURCE_DATABASE_URL);
        local = connect(targetUrl as string);
      }
    }
    log(`${job.name}: done`);
  } finally {
    await Promise.allSettled([source.end({ timeout: 5 }), local.end({ timeout: 5 })]);
  }
}

async function runDdl(url: string, ddl: string) {
  const sql = connect(url);
  try {
    await sql.unsafe(ddl);
  } finally {
    await sql.end();
  }
}

async function main() {
  if (finishOnly) {
    log("adding indexes and foreign keys to arena");
    await runDdl(DATABASE_URL as string, ARENA_FINISH_DDL);
    log("done");
    return;
  }

  await runDdl(DATABASE_URL as string, ARENA_DDL);
  // `create table if not exists` keeps whatever is there: rows without a pull in progress mean
  // DATABASE_URL isn't the freshly created database.
  const arena = connect(DATABASE_URL as string);
  const [state] = await arena`select (select count(*) from pull_progress)::int as progress,
    exists (select from summoners) or exists (select from matches) or exists (select from match_participants) as has_rows`;
  await arena.end();
  if (state?.progress === 0 && state.has_rows)
    throw new Error("arena has rows but no pull in progress: not a fresh database");
  if (useTunnel) await startTunnel();

  const jobs = onlyJob ? JOBS.filter((job) => job.name === onlyJob) : JOBS;
  if (jobs.length === 0) throw new Error(`No job named ${onlyJob}: ${JOBS.map((job) => job.name).join(", ")}`);
  for (const job of jobs) await runJob(job);
  log("all jobs done: run --finish next");
}

try {
  await main();
} finally {
  stopTunnel();
}
