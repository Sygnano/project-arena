// index.tsx — Arena Journey crawler, ported to run as a standalone Railway
// Function (Bun runtime). NOT part of the pnpm workspace and NOT imported
// by anything else in the repo — paste this file's contents into the
// Function's "Source Code" editor in the Railway dashboard.
//
// =============================================================================
// WHY THIS FILE EXISTS, AND ITS MAINTENANCE COST — READ BEFORE EDITING EITHER
// SIDE
// =============================================================================
// A Railway Function is an isolated single file: no access to this repo's
// node_modules, no @arena/db, no @arena/types. The real crawler
// (apps/api/scripts/crawl.ts) depends on six files across two workspace
// packages — schema, compression, parseMatch, parseRounds, the Riot client
// + rate limiter, and ingestSummoner. This file is a hand-copied port of
// all of them into one file, because that's the only way a Function can run
// it at all.
//
// This is a real cost, not a formality: packages/db/src/parseMatch.ts and
// parseRounds.ts are deliberately the SINGLE implementation every ingestion
// path shares (see CLAUDE.md §4) specifically so parsing logic never forks.
// This file is a second, disconnected copy of that logic. If parseMatch.ts,
// parseRounds.ts, ingestSummoner.ts, schema.ts, or the Riot client change
// and this file isn't updated to match, matches ingested through this
// Function will be parsed differently than matches ingested through the web
// app's search or `pnpm --filter @arena/api crawl` — silently, with no
// error. There is no automated check tying this file to its sources.
//
// Ported from (as of the commit that added this file):
//   packages/db/src/schema.ts        (summoners, matches, matchParticipants,
//                                      matchRounds tables only)
//   packages/db/src/compression.ts   (compressJson only — decompress isn't
//                                      needed by ingestion)
//   packages/db/src/parseMatch.ts    (in full)
//   packages/db/src/parseRounds.ts   (in full)
//   apps/api/src/riot/rateLimiter.ts (in full)
//   apps/api/src/riot/client.ts      (in full)
//   apps/api/src/ingestion/ingestSummoner.ts (in full)
//   apps/api/scripts/crawl.ts        (discoverFromStoredMatches and
//                                      refreshProfile unchanged; main() and
//                                      nextSummoner reworked to run forever,
//                                      see "HOW THIS RUNS")
//
// Before trusting a production run from this file, diff each section below
// against its source file and reconcile any drift.
//
// =============================================================================
// HOW THIS RUNS
// =============================================================================
// No server, no port, no URL to hit. The crawl starts as soon as the
// container starts and never stops on its own:
//   - It refreshes the summoner that's waited longest (never refreshed
//     first), then the next, like crawl.ts.
//   - Unlike crawl.ts, it only picks summoners that are due: never
//     refreshed, or last refreshed over CRAWL_REFRESH_AFTER_HOURS ago.
//     Without that cutoff an endless loop would come back around and
//     re-refresh people it finished minutes earlier.
//   - When nobody is due, it sleeps 10 minutes and looks again, so it never
//     runs out of work and exits.
//   - Errors never end the process. This Function can only be restarted 10
//     times, so each failure is waited out and retried: a failed summoner
//     is skipped for an hour, five failures in a row count as an outage and
//     back off (1 min, doubling up to 30), a database error waits a minute,
//     and a fatal Riot error (expired key) waits 30 minutes, since every
//     summoner would fail the same way until the key is fixed. Changing
//     RIOT_API_KEY in Railway redeploys the service anyway.
//   - Only a stop or redeploy (SIGTERM) ends it: the match in flight
//     finishes first, like crawl.ts's Ctrl-C. The next start picks up where
//     it left off.
//
// It runs alongside the live `api` service on the same RIOT_API_KEY, and
// the two rate-limit independently (see apps/api/src/riot/client.ts), so
// while this is running, searches on the site share the key's budget with
// it. That's the cost of an always-on crawler; CLAUDE.md §1 notes the site
// otherwise has no background crawler by design.
//
// =============================================================================
// ENV VARS (set these in the Railway dashboard's Variables tab)
// =============================================================================
//   DATABASE_URL               Same value as the `api` service's (e.g.
//                               ${{Postgres.DATABASE_URL}} if this Function
//                               lives in the same Railway project, which
//                               keeps the connection on the private network).
//   RIOT_API_KEY               Same value as the `api` service's
//                               (${{api.RIOT_API_KEY}}).
//   CRAWL_REFRESH_AFTER_HOURS  Optional, default 24. How old a summoner's
//                               last refresh must be before they're due
//                               again. Lower means fresher data and more Riot
//                               calls; never-refreshed summoners always go
//                               first either way.
//
// =============================================================================
// PLATFORM ASSUMPTIONS THIS FILE MAKES, UNVERIFIED FROM THIS REPO
// =============================================================================
// - Whether Railway's Function product is fine with a process that never
//   binds a port. The boilerplate this Function started from served HTTP
//   with Bun.serve, but nothing confirms a port is required. If Railway
//   marks the deployment crashed or unhealthy while "[crawl]" lines are
//   still printing, a listener really is required: add a minimal Bun.serve
//   answering "ok" next to main(), without changing the loop.
// - CONFIRMED from a real deploy (2026-09-22): Railway generates a real
//   package.json from versioned import specifiers and runs a real `bun
//   install` — this isn't on-the-fly URL resolution. But versioning a
//   SUBPATH import (e.g. "drizzle-orm@0.44.7/postgres-js") breaks
//   resolution: it silently drops the subpath and loads the package's root
//   module instead, which for drizzle-orm doesn't export `drizzle` at all
//   (that only exists under driver-specific subpaths). The one thing that
//   demonstrably works is the boilerplate's own pattern: version the bare
//   package once (`hono@4`), leave every subpath from that same package
//   unversioned (`hono/cors`) and ordered AFTER the versioned one so the
//   generator sees the version first. Every drizzle-orm import below
//   follows that pattern now — do not re-add a version to a subpath.
// - Bun's node:zlib compat includes brotliCompressSync with
//   BROTLI_PARAM_QUALITY. This matches the real compression.ts exactly, but
//   hasn't been executed in this environment to confirm.
//
// drizzle-orm/postgres versions pinned to what packages/db/package.json
// resolves to as of this port (0.44.7 / 3.4.9) — bump both together if that
// package's versions move.

import postgres from "postgres@3.4.9";
// Version pinned ONCE, on the bare package, listed first — see the
// "PLATFORM ASSUMPTIONS" note above for why. Every other drizzle-orm import
// below (its subpaths) is deliberately unversioned.
import { asc, eq, inArray, sql } from "drizzle-orm@0.44.7";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  smallint,
  primaryKey,
  customType,
  index,
} from "drizzle-orm/pg-core";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";

// -----------------------------------------------------------------------------
// SCHEMA — ported from packages/db/src/schema.ts (only the tables ingestion
// writes to; championCatalog/stats-only tables aren't needed here).
// -----------------------------------------------------------------------------

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const summoners = pgTable(
  "summoners",
  {
    puuid: text("puuid").primaryKey(),
    riotIdGameName: text("riot_id_game_name").notNull(),
    riotIdTagline: text("riot_id_tagline").notNull(),
    region: text("region").notNull(),
    profileIconId: integer("profile_icon_id"),
    summonerLevel: integer("summoner_level"),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
  },
  (table) => [index("summoners_last_refreshed_at_idx").on(table.lastRefreshedAt.asc().nullsFirst())],
);

const matches = pgTable("matches", {
  matchId: text("match_id").primaryKey(),
  region: text("region").notNull(),
  gameCreation: timestamp("game_creation", { withTimezone: true }).notNull(),
  raw: bytea("raw").notNull(),
  timeline: bytea("timeline"),
  bannedChampionIds: integer("banned_champion_ids").array(),
});

const matchParticipants = pgTable(
  "match_participants",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.matchId, { onDelete: "cascade" }),
    puuid: text("puuid").notNull(),
    riotIdGameName: text("riot_id_game_name"),
    riotIdTagline: text("riot_id_tagline"),
    teamId: integer("team_id").notNull(),
    placement: smallint("placement").notNull(),
    championId: integer("champion_id").notNull(),
    championName: text("champion_name").notNull(),
    augments: jsonb("augments").$type<number[]>().notNull(),
    items: jsonb("items").$type<number[]>().notNull(),
    kills: integer("kills").notNull(),
    deaths: integer("deaths").notNull(),
    assists: integer("assists").notNull(),
    goldEarned: integer("gold_earned").notNull(),
    damageDealtToChampions: integer("damage_dealt_to_champions").notNull(),

    timePlayedSeconds: integer("time_played_seconds"),
    damageDealtToChampionsPhysical: integer("damage_dealt_to_champions_physical"),
    damageDealtToChampionsMagic: integer("damage_dealt_to_champions_magic"),
    damageDealtToChampionsTrue: integer("damage_dealt_to_champions_true"),
    damageTakenPhysical: integer("damage_taken_physical"),
    damageTakenMagic: integer("damage_taken_magic"),
    damageTakenTrue: integer("damage_taken_true"),
    largestCriticalStrike: integer("largest_critical_strike"),
    healingAndShielding: integer("healing_and_shielding"),
    ccScoreSeconds: integer("cc_score_seconds"),
    ccTotalTimeDealt: integer("cc_total_time_dealt"),
    fistBumps: integer("fist_bumps"),
    qCasts: integer("q_casts"),
    wCasts: integer("w_casts"),
    eCasts: integer("e_casts"),
    rCasts: integer("r_casts"),
    summonerSpell1Casts: integer("summoner_spell_1_casts"),
    summonerSpell2Casts: integer("summoner_spell_2_casts"),
    summonerSpell1Id: integer("summoner_spell_1_id"),
    summonerSpell2Id: integer("summoner_spell_2_id"),
    pings: jsonb("pings").$type<{
      allIn: number;
      assistMe: number;
      basic: number;
      command: number;
      danger: number;
      enemyMissing: number;
      enemyVision: number;
      getBack: number;
      hold: number;
      needVision: number;
      onMyWay: number;
      push: number;
      retreat: number;
      visionCleared: number;
    }>(),
    statAnvilsBought: integer("stat_anvils_bought"),
    legendaryAnvilsBought: integer("legendary_anvils_bought"),
    prismaticAnvilsBought: integer("prismatic_anvils_bought"),
    bootsBought: jsonb("boots_bought").$type<number[]>(),
    bootsSold: jsonb("boots_sold").$type<number[]>(),
    purchasedItemIds: jsonb("purchased_item_ids").$type<number[]>(),
    damageSelfMitigated: integer("damage_self_mitigated"),
    doubleKills: integer("double_kills"),
    tripleKills: integer("triple_kills"),
    quadraKills: integer("quadra_kills"),
    pentaKills: integer("penta_kills"),
    largestKillingSpree: integer("largest_killing_spree"),
    firstBloodKill: boolean("first_blood_kill"),
    firstBloodAssist: boolean("first_blood_assist"),
    itemsPurchased: integer("items_purchased"),
    consumablesPurchased: integer("consumables_purchased"),
    soloKills: integer("solo_kills"),
    skillshotsHit: integer("skillshots_hit"),
    skillshotsDodged: integer("skillshots_dodged"),
    flawlessAces: integer("flawless_aces"),
    saveAllyFromDeath: integer("save_ally_from_death"),
    frames: jsonb("frames").$type<Array<[t: number, physical: number, magical: number, trueDamage: number]>>(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.puuid] }),
    index("match_participants_puuid_idx").on(table.puuid),
  ],
);

const matchRounds = pgTable(
  "match_rounds",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.matchId, { onDelete: "cascade" }),
    roundNumber: smallint("round_number").notNull(),
    winnerTeamId: integer("winner_team_id").notNull(),
    loserTeamId: integer("loser_team_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.matchId, table.roundNumber, table.winnerTeamId] })],
);

type NewMatch = typeof matches.$inferInsert;
type NewParticipant = typeof matchParticipants.$inferInsert;
type NewMatchRound = typeof matchRounds.$inferInsert;

// -----------------------------------------------------------------------------
// COMPRESSION — ported from packages/db/src/compression.ts (compressJson
// only; nothing here reads matches/timelines back).
// -----------------------------------------------------------------------------

const BROTLI_QUALITY = 9;

function compressJson(value: unknown): Buffer {
  return brotliCompressSync(JSON.stringify(value), {
    params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY },
  });
}

// -----------------------------------------------------------------------------
// PARSE MATCH — ported from packages/db/src/parseMatch.ts, in full. Riot DTO
// params are untyped here (the real file imports their shapes from
// @arena/types, unavailable to this Function) — every field access below
// mirrors the source exactly, so this only risks drifting if the DTO shapes
// themselves change, same as any other consumer of parseMatch.
// -----------------------------------------------------------------------------

const STAT_ANVIL_ITEM_ID = 220000;
const LEGENDARY_ANVIL_ITEM_IDS = new Set([220001, 220002, 220003, 220004, 220005, 220006]);
const PRISMATIC_ANVIL_ITEM_ID = 220007;

const ARENA_BOOT_ITEM_IDS: readonly number[] = [
  223005, 223006, 223008, 223009, 223020, 223047, 223111, 223158,
];
const ARENA_BOOT_ITEM_ID_SET = new Set(ARENA_BOOT_ITEM_IDS);

interface BootTransactions {
  bought: number[];
  sold: number[];
}

function bootTransactionsByParticipant(timelineDto: any): Map<number, BootTransactions> {
  const byParticipant = new Map<number, BootTransactions>();
  const entry = (participantId: number) => {
    let existing = byParticipant.get(participantId);
    if (!existing) {
      existing = { bought: [], sold: [] };
      byParticipant.set(participantId, existing);
    }
    return existing;
  };
  const popLast = (ids: number[], itemId: number) => {
    const index = ids.lastIndexOf(itemId);
    if (index !== -1) ids.splice(index, 1);
  };

  for (const frame of timelineDto.info.frames) {
    for (const event of frame.events) {
      if (typeof event.participantId !== "number") continue;
      const participantId = event.participantId;

      if (event.type === "ITEM_PURCHASED" || event.type === "ITEM_SOLD") {
        const itemId = event.itemId;
        if (typeof itemId !== "number" || !ARENA_BOOT_ITEM_ID_SET.has(itemId)) continue;
        if (event.type === "ITEM_PURCHASED") entry(participantId).bought.push(itemId);
        else entry(participantId).sold.push(itemId);
      } else if (event.type === "ITEM_UNDO") {
        const beforeId = typeof event.beforeId === "number" ? event.beforeId : 0;
        const afterId = typeof event.afterId === "number" ? event.afterId : 0;
        if (afterId === 0 && ARENA_BOOT_ITEM_ID_SET.has(beforeId)) {
          popLast(entry(participantId).bought, beforeId);
        } else if (beforeId === 0 && ARENA_BOOT_ITEM_ID_SET.has(afterId)) {
          popLast(entry(participantId).sold, afterId);
        }
      }
    }
  }
  return byParticipant;
}

function purchasedItemsByParticipant(timelineDto: any): Map<number, number[]> {
  const byParticipant = new Map<number, number[]>();
  for (const frame of timelineDto.info.frames) {
    for (const event of frame.events) {
      if (typeof event.participantId !== "number") continue;
      const list = byParticipant.get(event.participantId) ?? [];
      if (event.type === "ITEM_PURCHASED" && typeof event.itemId === "number") {
        list.push(event.itemId);
      } else if (event.type === "ITEM_UNDO") {
        const beforeId = typeof event.beforeId === "number" ? event.beforeId : 0;
        const afterId = typeof event.afterId === "number" ? event.afterId : 0;
        if (afterId === 0 && beforeId !== 0) {
          const index = list.lastIndexOf(beforeId);
          if (index !== -1) list.splice(index, 1);
        }
      } else continue;
      byParticipant.set(event.participantId, list);
    }
  }
  return byParticipant;
}

function participantAugments(p: any): number[] {
  return [p.playerAugment1, p.playerAugment2, p.playerAugment3, p.playerAugment4, p.playerAugment5, p.playerAugment6].filter(
    (augmentId) => augmentId !== 0,
  );
}

function participantItems(p: any): number[] {
  return [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6];
}

function bannedChampionIds(dto: any): number[] {
  return dto.info.teams.flatMap((team: any) => team.bans.map((b: any) => b.championId));
}

interface AnvilCounts {
  stat: number;
  legendary: number;
  prismatic: number;
}

function countAnvilPurchasesByParticipant(timelineDto: any): Map<number, AnvilCounts> {
  const counts = new Map<number, AnvilCounts>();
  const bump = (participantId: number, key: keyof AnvilCounts) => {
    const entry = counts.get(participantId) ?? { stat: 0, legendary: 0, prismatic: 0 };
    entry[key]++;
    counts.set(participantId, entry);
  };

  for (const frame of timelineDto.info.frames) {
    for (const event of frame.events) {
      if (event.type !== "ITEM_PURCHASED" || typeof event.participantId !== "number") continue;
      if (event.itemId === STAT_ANVIL_ITEM_ID) bump(event.participantId, "stat");
      else if (typeof event.itemId === "number" && LEGENDARY_ANVIL_ITEM_IDS.has(event.itemId)) {
        bump(event.participantId, "legendary");
      } else if (event.itemId === PRISMATIC_ANVIL_ITEM_ID) bump(event.participantId, "prismatic");
    }
  }
  return counts;
}

function buildFrameSeries(timelineDto: any, participantId: number): Array<[number, number, number, number]> {
  const key = String(participantId);
  return timelineDto.info.frames.map((frame: any) => {
    const damage = frame.participantFrames[key].damageStats;
    return [
      frame.timestamp,
      damage.physicalDamageDoneToChampions,
      damage.magicDamageDoneToChampions,
      damage.trueDamageDoneToChampions,
    ];
  });
}

function parseMatch(
  matchId: string,
  region: string,
  dto: any,
  timelineDto: any | null,
): { match: NewMatch; participants: NewParticipant[] } {
  const { info } = dto;

  const match: NewMatch = {
    matchId,
    region,
    gameCreation: new Date(info.gameCreation),
    raw: compressJson(dto),
    ...(timelineDto ? { timeline: compressJson(timelineDto) } : {}),
    bannedChampionIds: bannedChampionIds(dto),
  };

  const participantIdByPuuid = new Map<string, number>(
    timelineDto ? timelineDto.info.participants.map((p: any) => [p.puuid, p.participantId]) : [],
  );
  const anvilCountsByParticipantId = timelineDto
    ? countAnvilPurchasesByParticipant(timelineDto)
    : new Map<number, AnvilCounts>();
  const bootsByParticipantId = timelineDto
    ? bootTransactionsByParticipant(timelineDto)
    : new Map<number, BootTransactions>();
  const purchasesByParticipantId = timelineDto
    ? purchasedItemsByParticipant(timelineDto)
    : new Map<number, number[]>();

  const participants: NewParticipant[] = info.participants.map((p: any) => {
    const participantId = participantIdByPuuid.get(p.puuid);
    const anvilCounts = participantId !== undefined ? anvilCountsByParticipantId.get(participantId) : undefined;
    const statAnvilsBought = participantId !== undefined ? (anvilCounts?.stat ?? 0) : null;
    const legendaryAnvilsBought = participantId !== undefined ? (anvilCounts?.legendary ?? 0) : null;
    const prismaticAnvilsBought = participantId !== undefined ? (anvilCounts?.prismatic ?? 0) : null;
    const boots = participantId !== undefined ? bootsByParticipantId.get(participantId) : undefined;
    const bootsBought = participantId !== undefined ? (boots?.bought ?? []) : null;
    const bootsSold = participantId !== undefined ? (boots?.sold ?? []) : null;
    const purchasedItemIds = participantId !== undefined ? (purchasesByParticipantId.get(participantId) ?? []) : null;
    const frames = participantId !== undefined && timelineDto ? buildFrameSeries(timelineDto, participantId) : null;

    return {
      matchId,
      puuid: p.puuid,
      riotIdGameName: p.riotIdGameName,
      riotIdTagline: p.riotIdTagline,
      teamId: p.playerSubteamId,
      placement: p.subteamPlacement,
      championId: p.championId,
      championName: p.championName,
      augments: participantAugments(p),
      items: participantItems(p),
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      goldEarned: p.goldEarned,
      damageDealtToChampions: p.totalDamageDealtToChampions,

      timePlayedSeconds: p.timePlayed,
      damageDealtToChampionsPhysical: p.physicalDamageDealtToChampions,
      damageDealtToChampionsMagic: p.magicDamageDealtToChampions,
      damageDealtToChampionsTrue: p.trueDamageDealtToChampions,
      damageTakenPhysical: p.physicalDamageTaken,
      damageTakenMagic: p.magicDamageTaken,
      damageTakenTrue: p.trueDamageTaken,
      largestCriticalStrike: p.largestCriticalStrike,
      healingAndShielding:
        p.challenges?.effectiveHealAndShielding !== undefined ? Math.round(p.challenges.effectiveHealAndShielding) : null,
      ccScoreSeconds: p.timeCCingOthers,
      ccTotalTimeDealt: p.totalTimeCCDealt,
      fistBumps: p.challenges?.fistBumpParticipation ?? null,
      qCasts: p.spell1Casts,
      wCasts: p.spell2Casts,
      eCasts: p.spell3Casts,
      rCasts: p.spell4Casts,
      summonerSpell1Casts: p.summoner1Casts,
      summonerSpell2Casts: p.summoner2Casts,
      summonerSpell1Id: p.summoner1Id,
      summonerSpell2Id: p.summoner2Id,
      pings: {
        allIn: p.allInPings,
        assistMe: p.assistMePings,
        basic: p.basicPings,
        command: p.commandPings,
        danger: p.dangerPings,
        enemyMissing: p.enemyMissingPings,
        enemyVision: p.enemyVisionPings,
        getBack: p.getBackPings,
        hold: p.holdPings,
        needVision: p.needVisionPings,
        onMyWay: p.onMyWayPings,
        push: p.pushPings,
        retreat: p.retreatPings,
        visionCleared: p.visionClearedPings,
      },
      statAnvilsBought,
      legendaryAnvilsBought,
      prismaticAnvilsBought,
      bootsBought,
      bootsSold,
      purchasedItemIds,

      damageSelfMitigated: p.damageSelfMitigated,
      doubleKills: p.doubleKills,
      tripleKills: p.tripleKills,
      quadraKills: p.quadraKills,
      pentaKills: p.pentaKills,
      largestKillingSpree: p.largestKillingSpree,
      firstBloodKill: p.firstBloodKill,
      firstBloodAssist: p.firstBloodAssist,
      itemsPurchased: p.itemsPurchased,
      consumablesPurchased: p.consumablesPurchased,
      soloKills: p.challenges?.soloKills ?? null,
      skillshotsHit: p.challenges?.skillshotsHit ?? null,
      skillshotsDodged: p.challenges?.skillshotsDodged ?? null,
      flawlessAces: p.challenges?.flawlessAces ?? null,
      saveAllyFromDeath: p.challenges?.saveAllyFromDeath ?? null,
      frames,
    };
  });

  return { match, participants };
}

// -----------------------------------------------------------------------------
// PARSE ROUNDS — ported from packages/db/src/parseRounds.ts, in full.
// -----------------------------------------------------------------------------

const ROUND_GAP_MS = 40_000;

interface Kill {
  timestamp: number;
  killerTeam: number | undefined;
  victimTeam: number;
  victimId: number;
}

function parseRounds(matchId: string, dto: any, timelineDto: any): NewMatchRound[] {
  const teamByParticipantId = new Map<number, number>();
  const teamSize = new Map<number, number>();
  const teamByPuuid = new Map<string, number>(dto.info.participants.map((p: any) => [p.puuid, p.playerSubteamId]));
  for (const { participantId, puuid } of timelineDto.info.participants) {
    const team = teamByPuuid.get(puuid);
    if (team === undefined) continue;
    teamByParticipantId.set(participantId, team);
    teamSize.set(team, (teamSize.get(team) ?? 0) + 1);
  }

  const kills: Kill[] = [];
  for (const frame of timelineDto.info.frames) {
    for (const event of frame.events) {
      if (event.type !== "CHAMPION_KILL") continue;
      const victimId = event.victimId as number;
      const victimTeam = teamByParticipantId.get(victimId);
      if (victimTeam === undefined) continue;
      kills.push({
        timestamp: event.timestamp,
        killerTeam: teamByParticipantId.get(event.killerId as number),
        victimTeam,
        victimId,
      });
    }
  }
  kills.sort((a, b) => a.timestamp - b.timestamp);

  const rounds: Kill[][] = [];
  let previous = -Infinity;
  for (const kill of kills) {
    if (kill.timestamp - previous > ROUND_GAP_MS) rounds.push([]);
    rounds[rounds.length - 1]!.push(kill);
    previous = kill.timestamp;
  }

  const result: NewMatchRound[] = [];
  rounds.forEach((round, index) => {
    const opponentOf = new Map<number, number>();
    let ambiguous = false;
    for (const { killerTeam, victimTeam } of round) {
      if (killerTeam === undefined || killerTeam === victimTeam) continue;
      for (const [a, b] of [
        [killerTeam, victimTeam],
        [victimTeam, killerTeam],
      ] as const) {
        const known = opponentOf.get(a);
        if (known !== undefined && known !== b) ambiguous = true;
        opponentOf.set(a, b);
      }
    }
    if (ambiguous) return;

    for (const [teamA, teamB] of opponentOf) {
      if (teamA > teamB) continue;
      const duelKills = round.filter((k) => k.victimTeam === teamA || k.victimTeam === teamB);
      const wiped = (team: number) =>
        new Set(duelKills.filter((k) => k.victimTeam === team).map((k) => k.victimId)).size >= (teamSize.get(team) ?? Infinity);
      const aWiped = wiped(teamA);
      const bWiped = wiped(teamB);
      if (!aWiped && !bWiped) continue;

      const loser = aWiped && bWiped ? duelKills[duelKills.length - 1]!.victimTeam : aWiped ? teamA : teamB;
      result.push({
        matchId,
        roundNumber: index + 1,
        winnerTeamId: loser === teamA ? teamB : teamA,
        loserTeamId: loser,
      });
    }
  });
  return result;
}

// -----------------------------------------------------------------------------
// RATE LIMITER — ported from apps/api/src/riot/rateLimiter.ts, in full,
// unchanged.
// -----------------------------------------------------------------------------

class RateLimiter {
  private queue: Array<() => void> = [];
  private timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    return fn();
  }

  private waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.drain();
    });
  }

  private drain() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length < this.limit && this.queue.length > 0) {
      this.timestamps.push(now);
      const next = this.queue.shift()!;
      next();
      if (this.queue.length > 0) this.drain();
      return;
    }

    if (this.queue.length > 0) {
      const oldest = this.timestamps[0];
      const delay = oldest !== undefined ? this.windowMs - (now - oldest) : this.windowMs;
      setTimeout(() => this.drain(), Math.max(delay, 10));
    }
  }
}

class CompositeRateLimiter {
  private limiters: RateLimiter[];

  constructor(limits: Array<{ limit: number; windowMs: number }>) {
    this.limiters = limits.map((l) => new RateLimiter(l.limit, l.windowMs));
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.limiters.reduceRight<() => Promise<T>>((inner, limiter) => () => limiter.schedule(inner), fn);
    return run();
  }
}

// -----------------------------------------------------------------------------
// RIOT CLIENT — ported from apps/api/src/riot/client.ts, in full, unchanged
// (DTO return types loosened to `any`, same reasoning as parseMatch above).
// -----------------------------------------------------------------------------

const ARENA_QUEUE_ID = 1750;
const MATCH_ID_PAGE_SIZE = 100;
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 30_000;

const REGIONAL_CLUSTER: Record<string, "europe" | "americas" | "asia"> = {
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",
  kr: "asia",
  jp1: "asia",
};

function isSupportedRegion(region: string) {
  return Object.hasOwn(REGIONAL_CLUSTER, region.toLowerCase());
}

class RiotApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

class RiotClient {
  private limiter = new CompositeRateLimiter([
    { limit: 20, windowMs: 1000 },
    { limit: 100, windowMs: 120_000 },
  ]);

  constructor(private readonly apiKey: string) {}

  async getAccountByPuuid(puuid: string, region: string) {
    const cluster = this.clusterFor(region);
    return this.request<any>(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`,
      `Fetching account for puuid ${puuid} (${region})`,
    );
  }

  async getArenaMatchIdsByPuuid(puuid: string, region: string, startTime?: Date) {
    const cluster = this.clusterFor(region);
    const allIds: string[] = [];
    let start = 0;
    const since = startTime ? `&startTime=${Math.floor(startTime.getTime() / 1000)}` : "";

    while (true) {
      const page = await this.request<string[]>(
        `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${ARENA_QUEUE_ID}&start=${start}&count=${MATCH_ID_PAGE_SIZE}${since}`,
        `Fetching match ids for puuid ${puuid} (${region}) [start=${start}]`,
      );
      allIds.push(...page);
      if (page.length < MATCH_ID_PAGE_SIZE) break;
      start += MATCH_ID_PAGE_SIZE;
    }

    return allIds;
  }

  async getMatch(matchId: string, region: string) {
    const cluster = this.clusterFor(region);
    return this.request<any>(`https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}`, `Fetching match ${matchId}`);
  }

  async getSummonerByPuuid(puuid: string, region: string) {
    return this.request<any>(
      `https://${region.toLowerCase()}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      `Fetching summoner profile for puuid ${puuid} (${region})`,
    );
  }

  async getMatchTimeline(matchId: string, region: string) {
    const cluster = this.clusterFor(region);
    return this.request<any>(
      `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`,
      `Fetching timeline ${matchId}`,
    );
  }

  private clusterFor(region: string) {
    const cluster = REGIONAL_CLUSTER[region.toLowerCase()];
    if (!cluster) throw new Error(`Unknown Riot region "${region}" — add it to REGIONAL_CLUSTER`);
    return cluster;
  }

  private async request<T>(url: string, label: string, attempt = 1): Promise<T> {
    const result = await this.limiter.schedule(async (): Promise<{ data: T } | { retryInMs: number }> => {
      console.log(`[riot] ${label}`);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { "X-Riot-Token": this.apiKey },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        if (attempt >= MAX_ATTEMPTS) throw err;
        const waitMs = 5000 * attempt;
        console.log(`[riot] ${label} -> network error (${err instanceof Error ? err.message : err}), retrying in ${waitMs}ms`);
        return { retryInMs: waitMs };
      }
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 * attempt) * 1000;
        console.log(`[riot] ${label} -> ${res.status}, retrying in ${waitMs}ms`);
        return { retryInMs: waitMs };
      }
      if (!res.ok) {
        console.log(`[riot] ${label} -> ${res.status}`);
        const body = await res.text();
        if (res.status === 400 && body.includes("Exception decrypting")) {
          throw new RiotApiError(
            res.status,
            `Riot API 400 for ${url}: PUUID was issued to a different Riot app than RIOT_API_KEY's — run \`pnpm --filter @arena/db remap-puuids\` (from the real repo, not this Function)`,
          );
        }
        throw new RiotApiError(res.status, `Riot API ${res.status} for ${url}`);
      }
      return { data: (await res.json()) as T };
    });
    if ("data" in result) return result.data;
    await new Promise((resolve) => setTimeout(resolve, result.retryInMs));
    return this.request<T>(url, label, attempt + 1);
  }
}

// -----------------------------------------------------------------------------
// INGEST SUMMONER — ported from apps/api/src/ingestion/ingestSummoner.ts, in
// full. `db`/`riot` are module-level singletons here instead of parameters
// (see "WIRING" below), everything else unchanged.
// -----------------------------------------------------------------------------

type IngestProgress = { phase: "matchIds" } | { phase: "matches"; done: number; total: number };
interface IngestOptions {
  shouldStop?: () => boolean;
}

const REFRESH_OVERLAP_MS = 2 * 60 * 60_000;

function participantSummoners(dto: any, region: string) {
  return dto.info.participants
    .filter((p: any) => p.riotIdGameName && p.riotIdTagline)
    .map((p: any) => ({
      puuid: p.puuid,
      riotIdGameName: p.riotIdGameName,
      riotIdTagline: p.riotIdTagline,
      region,
      profileIconId: p.profileIcon ?? null,
      summonerLevel: p.summonerLevel ?? null,
    }));
}

async function ingestSummoner(
  db: Db,
  riot: RiotClient,
  summoner: { puuid: string; region: string },
  onProgress?: (progress: IngestProgress) => void,
  options: IngestOptions = {},
) {
  const startedAt = new Date();
  const [previous] = await db.select({ lastRefreshedAt: summoners.lastRefreshedAt }).from(summoners).where(eq(summoners.puuid, summoner.puuid));
  const since = previous?.lastRefreshedAt ? new Date(previous.lastRefreshedAt.getTime() - REFRESH_OVERLAP_MS) : undefined;

  onProgress?.({ phase: "matchIds" });
  const recentMatchIds = await riot.getArenaMatchIdsByPuuid(summoner.puuid, summoner.region, since);

  const existing =
    recentMatchIds.length === 0
      ? []
      : await db.select({ matchId: matches.matchId }).from(matches).where(inArray(matches.matchId, recentMatchIds));
  const existingIds = new Set(existing.map((m) => m.matchId));

  const newMatchIds = recentMatchIds.filter((id) => !existingIds.has(id));

  let ingested = 0;
  let discovered = 0;
  onProgress?.({ phase: "matches", done: 0, total: newMatchIds.length });
  for (const matchId of newMatchIds) {
    if (options.shouldStop?.()) return { ingested, discovered, stopped: true };

    const dto = await riot.getMatch(matchId, summoner.region);
    const timelineDto = await riot.getMatchTimeline(matchId, summoner.region);
    const { match, participants } = parseMatch(matchId, summoner.region, dto, timelineDto);
    const rounds = timelineDto ? parseRounds(matchId, dto, timelineDto) : [];
    const players = participantSummoners(dto, summoner.region);

    await db.transaction(async (tx) => {
      await tx.insert(matches).values(match).onConflictDoNothing({ target: matches.matchId });
      await tx.insert(matchParticipants).values(participants).onConflictDoNothing();
      if (rounds.length > 0) await tx.insert(matchRounds).values(rounds).onConflictDoNothing();
      if (players.length > 0) {
        const inserted = await tx.insert(summoners).values(players).onConflictDoNothing({ target: summoners.puuid }).returning({ puuid: summoners.puuid });
        discovered += inserted.length;
      }
    });
    ingested += 1;
    onProgress?.({ phase: "matches", done: ingested, total: newMatchIds.length });
  }

  await db.update(summoners).set({ lastRefreshedAt: startedAt }).where(eq(summoners.puuid, summoner.puuid));

  return { ingested, discovered, stopped: false };
}

function isFatal(err: unknown) {
  if (!(err instanceof RiotApiError)) return false;
  return err.status === 401 || err.status === 403 || err.message.includes("remap-puuids");
}

// -----------------------------------------------------------------------------
// CRAWL STEP — ported from apps/api/scripts/crawl.ts's discoverFromStoredMatches,
// nextSummoner and refreshProfile, unchanged. main() (near the bottom of this
// file) is the counterpart to crawl.ts's own main().
// -----------------------------------------------------------------------------

async function discoverFromStoredMatches(db: Db) {
  const rows = await db.execute<{ match_id: string }>(sql`
    select distinct mp.match_id
    from match_participants mp
    where not exists (select 1 from summoners s where s.puuid = mp.puuid)
  `);
  const matchIds = rows.map((row) => row.match_id);
  if (matchIds.length === 0) return 0;
  console.log(`[crawl] seeding: ${matchIds.length} stored match(es) have players not in summoners yet`);

  let discovered = 0;
  for (let i = 0; i < matchIds.length; i += 50) {
    const batch = await db
      .select({ region: matches.region, raw: matches.raw })
      .from(matches)
      .where(inArray(matches.matchId, matchIds.slice(i, i + 50)));
    for (const match of batch) {
      const dto = JSON.parse(brotliDecompressSync(match.raw).toString("utf-8"));
      const players = dto.info.participants
        .filter((p: any) => p.riotIdGameName && p.riotIdTagline)
        .map((p: any) => ({
          puuid: p.puuid,
          riotIdGameName: p.riotIdGameName,
          riotIdTagline: p.riotIdTagline,
          region: match.region,
          profileIconId: p.profileIcon ?? null,
          summonerLevel: p.summonerLevel ?? null,
        }));
      if (players.length === 0) continue;
      const inserted = await db.insert(summoners).values(players).onConflictDoNothing({ target: summoners.puuid }).returning({ puuid: summoners.puuid });
      discovered += inserted.length;
    }
  }
  return discovered;
}

/**
 * The next summoner that's due: never refreshed, or last refreshed longer
 * ago than `refreshAfterMs`, oldest first (the same order as crawl.ts).
 * Unlike crawl.ts, which walks the whole table in one sitting, this runs
 * forever, so without the cutoff it would re-refresh someone it finished a
 * minute ago as soon as it came back around. `skip` holds summoners backing
 * off after a failure.
 */
async function nextSummoner(db: Db, skip: ReadonlySet<string>, refreshAfterMs: number) {
  const cutoff = new Date(Date.now() - refreshAfterMs);
  const candidates = await db
    .select({
      puuid: summoners.puuid,
      region: summoners.region,
      name: sql<string>`${summoners.riotIdGameName} || '#' || ${summoners.riotIdTagline}`,
      lastRefreshedAt: summoners.lastRefreshedAt,
    })
    .from(summoners)
    .where(sql`${summoners.lastRefreshedAt} is null or ${summoners.lastRefreshedAt} < ${cutoff}`)
    .orderBy(sql`${summoners.lastRefreshedAt} asc nulls first`, asc(summoners.puuid))
    .limit(skip.size + 1);
  return candidates.find((candidate) => !skip.has(candidate.puuid));
}

async function refreshProfile(db: Db, riot: RiotClient, summoner: { puuid: string; region: string; name: string }) {
  try {
    const account = await riot.getAccountByPuuid(summoner.puuid, summoner.region);
    const profile = await riot.getSummonerByPuuid(summoner.puuid, summoner.region);
    const next = {
      riotIdGameName: account.gameName,
      riotIdTagline: account.tagLine,
      profileIconId: profile.profileIconId,
      summonerLevel: profile.summonerLevel,
    };
    await db.update(summoners).set(next).where(eq(summoners.puuid, summoner.puuid));
    const name = `${account.gameName}#${account.tagLine}`;
    if (name !== summoner.name) console.log(`[crawl]   ${summoner.name} is now ${name}`);
    return name;
  } catch (err) {
    if (isFatal(err)) throw err;
    console.warn(`[crawl]   ${summoner.name}: profile refresh failed, keeping the stored one:`, err instanceof Error ? err.message : err);
    return summoner.name;
  }
}

// This Function can only be restarted 10 times, so the loop below never
// exits on its own: every failure is waited out and retried instead of
// ending the process. Only SIGTERM/SIGINT (a stop or redeploy) ends it.
const MAX_CONSECUTIVE_FAILURES = 5;
// A summoner whose refresh failed is skipped this long before being tried again.
const FAILED_RETRY_MS = 60 * 60_000;
// Nothing due: wait this long, then look again.
const IDLE_SLEEP_MS = 10 * 60_000;
// Several summoners failing in a row (network, database or Riot down):
// wait, doubling each time it happens again, up to OUTAGE_SLEEP_MAX_MS.
const OUTAGE_SLEEP_MS = 60_000;
const OUTAGE_SLEEP_MAX_MS = 30 * 60_000;
// A fatal Riot error (expired key, PUUIDs from another app) fails every
// summoner the same way; retrying sooner would only spend calls. Updating
// RIOT_API_KEY in Railway redeploys the service, which starts over anyway.
const FATAL_SLEEP_MS = 30 * 60_000;

let stopRequested = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    console.log(`[crawl] ${signal} received, stopping after the current match`);
  });
}
// A stray rejected promise must not take the process (and a restart) down.
process.on("unhandledRejection", (err) => {
  console.error("[crawl] unhandled rejection:", err instanceof Error ? err.message : err);
});

/** Waits `ms`, but wakes up within a second of a stop request. */
async function sleep(ms: number) {
  const until = Date.now() + ms;
  while (!stopRequested && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000, until - Date.now())));
  }
}

/**
 * Crawls forever: the summoner that's been waiting longest (never refreshed
 * first, then anyone last refreshed over CRAWL_REFRESH_AFTER_HOURS ago),
 * then the next. When nobody is due it sleeps and looks again, so it never
 * runs out of work and exits. Errors are logged, waited out and retried,
 * never thrown. SIGTERM (Railway's stop/redeploy) finishes the match in
 * flight, then stops cleanly, like crawl.ts's Ctrl-C.
 */
async function main() {
  const refreshAfterHours = Number((import.meta.env.CRAWL_REFRESH_AFTER_HOURS as string | undefined) ?? "24");
  if (!(refreshAfterHours > 0)) throw new Error("CRAWL_REFRESH_AFTER_HOURS must be a positive number if set");
  const refreshAfterMs = refreshAfterHours * 60 * 60_000;

  console.log(`[crawl] starting: crawls forever, refreshing anyone not refreshed in ${refreshAfterHours}h`);

  // puuid -> when it may be tried again.
  const failedUntil = new Map<string, number>();
  let consecutiveFailures = 0;
  let outageSleepMs = OUTAGE_SLEEP_MS;
  let crawled = 0;
  let totalIngested = 0;
  let totalDiscovered = 0;
  let seedNeeded = true;

  while (!stopRequested) {
    try {
      // Picks up players from stored matches that aren't in summoners yet.
      // One cheap query once that's done, so it reruns each time the queue
      // runs dry.
      if (seedNeeded) {
        const seeded = await discoverFromStoredMatches(db);
        if (seeded > 0) console.log(`[crawl] added ${seeded} player(s) from already-stored matches`);
        seedNeeded = false;
      }

      const now = Date.now();
      for (const [puuid, until] of failedUntil) if (until <= now) failedUntil.delete(puuid);

      const summoner = await nextSummoner(db, new Set(failedUntil.keys()), refreshAfterMs);
      if (!summoner) {
        console.log(
          `[crawl] nobody due (${crawled} refreshed, ${totalIngested} match(es) stored, ${totalDiscovered} player(s) discovered so far), checking again in ${IDLE_SLEEP_MS / 60_000} min`,
        );
        seedNeeded = true;
        await sleep(IDLE_SLEEP_MS);
        continue;
      }

      const last = summoner.lastRefreshedAt ? summoner.lastRefreshedAt.toISOString() : "never";
      console.log(`[crawl] ${summoner.name} (${summoner.region}, last refreshed ${last})`);
      try {
        const name = await refreshProfile(db, riot, summoner);
        const result = await ingestSummoner(
          db,
          riot,
          summoner,
          (progress) => {
            if (progress.phase === "matches" && progress.total > 0) {
              console.log(`[crawl]   ${name}: match ${progress.done}/${progress.total}`);
            }
          },
          { shouldStop: () => stopRequested },
        );
        totalIngested += result.ingested;
        totalDiscovered += result.discovered;
        if (result.stopped) {
          console.log(`[crawl]   ${name}: stopped early, resumes on the next start`);
          break;
        }
        crawled += 1;
        consecutiveFailures = 0;
        outageSleepMs = OUTAGE_SLEEP_MS;
        console.log(`[crawl]   ${name}: done, ${result.ingested} match(es) stored, ${result.discovered} new player(s)`);
      } catch (err) {
        if (isFatal(err)) {
          console.error(
            `[crawl] fatal Riot error, every summoner would fail the same way (check RIOT_API_KEY): ${err instanceof Error ? err.message : err}. Retrying in ${FATAL_SLEEP_MS / 60_000} min`,
          );
          await sleep(FATAL_SLEEP_MS);
          continue;
        }
        failedUntil.set(summoner.puuid, Date.now() + FAILED_RETRY_MS);
        consecutiveFailures += 1;
        console.error(
          `[crawl] ${summoner.name} failed, retrying them in ${FAILED_RETRY_MS / 60_000} min:`,
          err instanceof Error ? err.message : err,
        );
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(
            `[crawl] ${consecutiveFailures} summoners failed in a row, looks like an outage (network, database or Riot). Waiting ${Math.round(outageSleepMs / 60_000)} min; nothing was half-written`,
          );
          await sleep(outageSleepMs);
          outageSleepMs = Math.min(outageSleepMs * 2, OUTAGE_SLEEP_MAX_MS);
          consecutiveFailures = 0;
          // The failures were the outage, not those players: retry them all.
          failedUntil.clear();
        }
      }
    } catch (err) {
      // The database itself failed (nextSummoner, the seeding query): wait
      // for it to come back. postgres.js reconnects on the next query.
      console.error(
        `[crawl] database error, retrying in ${OUTAGE_SLEEP_MS / 60_000} min:`,
        err instanceof Error ? err.message : err,
      );
      await sleep(OUTAGE_SLEEP_MS);
    }
  }

  console.log(`[crawl] stopped: ${crawled} summoner(s) refreshed, ${totalIngested} match(es) stored, ${totalDiscovered} player(s) discovered`);
}

// -----------------------------------------------------------------------------
// WIRING — module-level singletons, created once when this container starts.
// -----------------------------------------------------------------------------

const client = postgres(import.meta.env.DATABASE_URL as string);
const db = drizzle(client, { schema: { summoners, matches, matchParticipants, matchRounds } });
type Db = typeof db;

const riot = new RiotClient(import.meta.env.RIOT_API_KEY as string);

// Starts crawling as soon as the container starts: no server, no port, no
// request to trigger it. main() only returns after a stop request.
main()
  .catch((err) => {
    // Only a bad CRAWL_REFRESH_AFTER_HOURS gets here; the loop catches the rest.
    console.error("[crawl] aborted:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
