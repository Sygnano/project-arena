import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  alias,
  and,
  ARENA_BOOT_ITEM_IDS,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  sql,
  summoners,
  matches,
  matchParticipants,
  matchRounds,
  type Summoner,
} from "@arena/db";
import type {
  AbilityCastBreakdown,
  AugmentPickBreakdown,
  AugmentStats,
  BannedChampionStats,
  BootStats,
  BootsStats,
  CalendarDayStats,
  ChampionCatalogEntry,
  ChampionGames,
  ChampionPickBreakdown,
  ChampionAugmentStats,
  ChampionFormStats,
  ChampionStats,
  DamageBestGames,
  DamageBreakdown,
  GuestOfHonorChampionStats,
  MetaAugmentStats,
  OpponentStats,
  PingBreakdown,
  PlacementDetail,
  PrismaticItemPickBreakdown,
  PrismaticItemStats,
  ItemOutcomeStats,
  SummonerStatsResponse,
  TeammateStats,
  TeamSlotBreakdown,
  TeamSynergyChampionNode,
  TeamSynergyPairStats,
} from "@arena/types";
import { db } from "../db.js";
import { getChampionDisplayNames, getChampionNamesById } from "../championData.js";
import {
  getCatalogAugments,
  getGuestOfHonorAugmentDetails,
  GUEST_OF_HONOR_CHAMPIONS,
  getMetaAugments,
  augmentIconUrl,
} from "../augmentData.js";
import {
  getArenaBoots,
  getBuildItemFilter,
  getItemGoldById,
  getItemNamesById,
  getLegendaryItemFilter,
  getPrismaticItems,
  itemIconUrl,
  SHARDBLADE_ITEM_ID,
  SPECIAL_ITEM_IDS,
} from "../itemData.js";
import { getSummonerSpells } from "../summonerSpellData.js";
import { buildSummonerSpellStats } from "../stats/summonerSpells.js";
import { buildDamageCurveStats, type DamageCurveGameRow } from "../stats/damageCurves.js";
import { isSupportedRegion, riot, RiotApiError } from "../riot/index.js";
import { refreshQueue } from "../ingestion/index.js";
import { clientIp, SlidingWindowLimiter } from "../rateLimit.js";

// Caps `TeamSynergyStats.champions`/`.matrix` to this many individually-named
// arcs — a friend group's tracked history can span far more distinct
// champions than a chord diagram can legibly render as separate labeled
// arcs. Anyone past this cap is folded into one aggregate "Other" arc rather
// than dropped (see below), so this is a legibility cap, not a data cap.
const TEAM_SYNERGY_MAX_CHAMPIONS = 20;
// Teammate champions listed on Team Synergy: seen on your team at least twice.
const TEAMMATE_CHAMPIONS_MIN_GAMES = 2;
// A pairing needs at least this many shared matches before it's eligible for
// `bestPairing` — otherwise a single lucky top1 with a rarely-repeated
// partner would read as a "100% win rate" duo off a sample size of one.
// Matches the web app's shared minimum sample (apps/web/src/lib/sample.ts):
// a "best pair" from 3 games read as a 100% top 3 rate on the dial.
const TEAM_SYNERGY_MIN_PAIR_SAMPLE = 5;

// Teammates/opponents met only once are left out of the lists — a one-off matchmade name carries no signal and,
// measured on real data, made up 94% of teammates and 86% of opponents
// (4,206 opponent rows, all rendered). The true totals still ship separately.
const MIN_SHARED_GAMES_LISTED = 2;

/** How many of the most recent placements ship for the "recent form" strip. */
const RECENT_PLACEMENTS_COUNT = 10;

// A searched summoner refreshed longer ago than this is refreshed again
// before the recap shows.
const REFRESH_STALE_MS = 15 * 60_000;

// Lookups (every search, refresh and "fetch matches" press) per visitor IP.
// Generous for a person typing, tight for a script: an unknown Riot ID
// costs two Riot calls.
const lookupLimiter = new SlidingWindowLimiter(30, 10 * 60_000);
// First fetches (a never-fetched summoner's whole history, ~2.4s a match
// on a dev key) per visitor IP: the expensive thing to abuse.
const firstFetchLimiter = new SlidingWindowLimiter(5, 60 * 60_000);
// New first fetches are refused while this many jobs already wait, so a
// flood can't push the friend group's refreshes back by hours.
const MAX_WAITING_JOBS = 10;

// Riot ID rules: a 3-16 character game name (any letters, digits, spaces)
// and a 3-5 character alphanumeric tag line. Counted in code points, since
// names can use non-Latin scripts. Mirrored in apps/web/src/lib/riot-id.ts.
const lookupSchema = z.object({
  region: z
    .string()
    .transform((region) => region.toLowerCase())
    .refine(isSupportedRegion),
  gameName: z
    .string()
    .trim()
    .refine((name) => [...name].length >= 3 && [...name].length <= 16 && !name.includes("#")),
  tagLine: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N}]{3,5}$/u),
  // Queue the first fetch of a never-fetched summoner. Only the summoner
  // page's "fetch matches" button sends it: a search alone just resolves
  // the Riot ID, so a first full-history fetch always takes a deliberate
  // click. Stale summoners that were fetched before refresh either way.
  fetch: z.boolean().optional(),
});

async function buildSummonerStats(summoner: Summoner): Promise<SummonerStatsResponse> {
  // Every query below that depends only on the summoner starts here, at once,
  // instead of one round trip after another (~110 ms of latency each against
  // the hosted database). Each is still awaited where its result is used; the
  // no-op catch only stops an early rejection from counting as unhandled
  // before that await is reached.
  const aggQuery = Promise.resolve(db
    .select({
      matchesPlayed: sql<number>`count(*)::int`,
      top3Finishes: sql<number>`count(*) filter (where ${matchParticipants.placement} <= 3)::int`,
      avgPlacement: sql<number>`coalesce(avg(${matchParticipants.placement}), 0)::float`,
      kills: sql<number>`coalesce(sum(${matchParticipants.kills}), 0)::int`,
      deaths: sql<number>`coalesce(sum(${matchParticipants.deaths}), 0)::int`,
      assists: sql<number>`coalesce(sum(${matchParticipants.assists}), 0)::int`,
      timePlayedSeconds: sql<number>`coalesce(sum(${matchParticipants.timePlayedSeconds}), 0)::int`,
      longestGameSeconds: sql<number>`coalesce(max(${matchParticipants.timePlayedSeconds}), 0)::int`,
      mostKills: sql<number>`coalesce(max(${matchParticipants.kills}), 0)::int`,
      mostDeaths: sql<number>`coalesce(max(${matchParticipants.deaths}), 0)::int`,
      mostAssists: sql<number>`coalesce(max(${matchParticipants.assists}), 0)::int`,
      // Best single-match KDA, not the average — computed per-row then
      // maxed, same zero-death rule as the overall `kda` below.
      bestKda: sql<number>`coalesce(max(
        case when ${matchParticipants.deaths} = 0
          then (${matchParticipants.kills} + ${matchParticipants.assists})
          else (${matchParticipants.kills} + ${matchParticipants.assists})::float / ${matchParticipants.deaths}
        end
      ), 0)`,
      totalDamagePhysical: sql<number>`coalesce(sum(${matchParticipants.damageDealtToChampionsPhysical}), 0)::int`,
      totalDamageMagical: sql<number>`coalesce(sum(${matchParticipants.damageDealtToChampionsMagic}), 0)::int`,
      totalDamageTrue: sql<number>`coalesce(sum(${matchParticipants.damageDealtToChampionsTrue}), 0)::int`,
      totalDamageTakenPhysical: sql<number>`coalesce(sum(${matchParticipants.damageTakenPhysical}), 0)::int`,
      totalDamageTakenMagical: sql<number>`coalesce(sum(${matchParticipants.damageTakenMagic}), 0)::int`,
      totalDamageTakenTrue: sql<number>`coalesce(sum(${matchParticipants.damageTakenTrue}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const globalMaxDamageGameQuery = Promise.resolve(db
    .select({
      physical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsPhysical}, 0)::int`,
      magical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsMagic}, 0)::int`,
      trueDamage: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsTrue}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(desc(matchParticipants.damageDealtToChampions))
    .limit(1));
  const globalMaxDamageTakenGameQuery = Promise.resolve(db
    .select({
      physical: sql<number>`coalesce(${matchParticipants.damageTakenPhysical}, 0)::int`,
      magical: sql<number>`coalesce(${matchParticipants.damageTakenMagic}, 0)::int`,
      trueDamage: sql<number>`coalesce(${matchParticipants.damageTakenTrue}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(
      desc(sql`coalesce(${matchParticipants.damageTakenPhysical}, 0)
        + coalesce(${matchParticipants.damageTakenMagic}, 0)
        + coalesce(${matchParticipants.damageTakenTrue}, 0)`),
    )
    .limit(1));
  const killsAggQuery = Promise.resolve(db
    .select({
      doubleKills: sql<number>`coalesce(sum(${matchParticipants.doubleKills}), 0)::int`,
      tripleKills: sql<number>`coalesce(sum(${matchParticipants.tripleKills}), 0)::int`,
      quadraKills: sql<number>`coalesce(sum(${matchParticipants.quadraKills}), 0)::int`,
      pentaKills: sql<number>`coalesce(sum(${matchParticipants.pentaKills}), 0)::int`,
      largestKillingSpree: sql<number>`coalesce(max(${matchParticipants.largestKillingSpree}), 0)::int`,
      firstBloodKills: sql<number>`count(*) filter (where ${matchParticipants.firstBloodKill} = true)::int`,
      firstBloodAssists: sql<number>`count(*) filter (where ${matchParticipants.firstBloodAssist} = true)::int`,
      soloKills: sql<number>`coalesce(sum(${matchParticipants.soloKills}), 0)::int`,
      flawlessAces: sql<number>`coalesce(sum(${matchParticipants.flawlessAces}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const economyAggQuery = Promise.resolve(db
    .select({
      totalGoldEarned: sql<number>`coalesce(sum(${matchParticipants.goldEarned}), 0)::int`,
      mostGoldInOneGame: sql<number>`coalesce(max(${matchParticipants.goldEarned}), 0)::int`,
      itemsPurchased: sql<number>`coalesce(sum(${matchParticipants.itemsPurchased}), 0)::int`,
      consumablesPurchased: sql<number>`coalesce(sum(${matchParticipants.consumablesPurchased}), 0)::int`,
      statAnvils: sql<number>`coalesce(sum(${matchParticipants.statAnvilsBought}), 0)::int`,
      legendaryAnvils: sql<number>`coalesce(sum(${matchParticipants.legendaryAnvilsBought}), 0)::int`,
      prismaticAnvils: sql<number>`coalesce(sum(${matchParticipants.prismaticAnvilsBought}), 0)::int`,
      mostStatAnvilsInOneMatch: sql<number>`coalesce(max(${matchParticipants.statAnvilsBought}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const utilityAggQuery = Promise.resolve(db
    .select({
      totalHealingAndShielding: sql<number>`coalesce(sum(${matchParticipants.healingAndShielding}), 0)::int`,
      totalCcScoreSeconds: sql<number>`coalesce(sum(${matchParticipants.ccScoreSeconds}), 0)::int`,
      totalCcTimeDealt: sql<number>`coalesce(sum(${matchParticipants.ccTotalTimeDealt}), 0)::int`,
      totalSavesFromDeath: sql<number>`coalesce(sum(${matchParticipants.saveAllyFromDeath}), 0)::int`,
      // Independently maxed per field (see `UtilityStats.bestByType`'s doc
      // comment) — a plain MAX() per column, not a DISTINCT ON single-match
      // row, since the four fields aren't expected to peak in the same game.
      bestHealingAndShielding: sql<number>`coalesce(max(${matchParticipants.healingAndShielding}), 0)::int`,
      bestCcScoreSeconds: sql<number>`coalesce(max(${matchParticipants.ccScoreSeconds}), 0)::int`,
      bestCcTimeDealt: sql<number>`coalesce(max(${matchParticipants.ccTotalTimeDealt}), 0)::int`,
      bestSavesFromDeath: sql<number>`coalesce(max(${matchParticipants.saveAllyFromDeath}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const abilityAggQuery = Promise.resolve(db
    .select({
      totalQCasts: sql<number>`coalesce(sum(${matchParticipants.qCasts}), 0)::int`,
      totalWCasts: sql<number>`coalesce(sum(${matchParticipants.wCasts}), 0)::int`,
      totalECasts: sql<number>`coalesce(sum(${matchParticipants.eCasts}), 0)::int`,
      totalRCasts: sql<number>`coalesce(sum(${matchParticipants.rCasts}), 0)::int`,
      totalSkillshotsHit: sql<number>`coalesce(sum(${matchParticipants.skillshotsHit}), 0)::int`,
      bestSkillshotsHit: sql<number>`coalesce(max(${matchParticipants.skillshotsHit}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const globalMaxAbilityGameQuery = Promise.resolve(db
    .select({
      q: sql<number>`coalesce(${matchParticipants.qCasts}, 0)::int`,
      w: sql<number>`coalesce(${matchParticipants.wCasts}, 0)::int`,
      e: sql<number>`coalesce(${matchParticipants.eCasts}, 0)::int`,
      r: sql<number>`coalesce(${matchParticipants.rCasts}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(
      desc(sql`coalesce(${matchParticipants.qCasts}, 0)
        + coalesce(${matchParticipants.wCasts}, 0)
        + coalesce(${matchParticipants.eCasts}, 0)
        + coalesce(${matchParticipants.rCasts}, 0)`),
    )
    .limit(1));
  const funAggQuery = Promise.resolve(db
    .select({
      totalFistBumps: sql<number>`coalesce(sum(${matchParticipants.fistBumps}), 0)::int`,
      totalSkillshotsDodged: sql<number>`coalesce(sum(${matchParticipants.skillshotsDodged}), 0)::int`,
      bestSkillshotsDodged: sql<number>`coalesce(max(${matchParticipants.skillshotsDodged}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const pingsRowsQuery = Promise.resolve(db
    .select({ pings: matchParticipants.pings })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const placementRowsQuery = Promise.resolve(db
    .select({
      placement: matchParticipants.placement,
      count: sql<number>`count(*)::int`,
      avgGameSeconds: sql<number>`coalesce(avg(${matchParticipants.timePlayedSeconds}), 0)::float`,
      kills: sql<number>`coalesce(sum(${matchParticipants.kills}), 0)::int`,
      deaths: sql<number>`coalesce(sum(${matchParticipants.deaths}), 0)::int`,
      assists: sql<number>`coalesce(sum(${matchParticipants.assists}), 0)::int`,
      avgDamage: sql<number>`coalesce(avg(${matchParticipants.damageDealtToChampions}), 0)::float`,
      avgAugments: sql<number>`coalesce(avg(jsonb_array_length(${matchParticipants.augments})), 0)::float`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.placement));
  const placementChampionRowsQuery = Promise.resolve(db
    .select({
      placement: matchParticipants.placement,
      championName: matchParticipants.championName,
      count: sql<number>`count(*)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.placement, matchParticipants.championName));
  const placementByMatchRowsQuery = Promise.resolve(db
    .select({
      placement: matchParticipants.placement,
      gameCreation: matches.gameCreation,
      championName: matchParticipants.championName,
      kills: matchParticipants.kills,
      deaths: matchParticipants.deaths,
      assists: matchParticipants.assists,
      timePlayedSeconds: matchParticipants.timePlayedSeconds,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(asc(matches.gameCreation)));
  const calendarRowsQuery = Promise.resolve(db
    .select({
      date: sql<string>`(${matches.gameCreation} at time zone 'UTC')::date::text`,
      gamesPlayed: sql<number>`count(*)::int`,
      top3Finishes: sql<number>`count(*) filter (where ${matchParticipants.placement} <= 3)::int`,
      avgPlacement: sql<number>`avg(${matchParticipants.placement})::float`,
      bestPlacement: sql<number>`min(${matchParticipants.placement})::int`,
      timePlayedSeconds: sql<number>`coalesce(sum(${matchParticipants.timePlayedSeconds}), 0)::int`,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(sql`(${matches.gameCreation} at time zone 'UTC')::date`));
  const hourRowsQuery = Promise.resolve(db
    .select({
      hour: sql<number>`extract(hour from (${matches.gameCreation} at time zone 'UTC'))::int`,
      gamesPlayed: sql<number>`count(*)::int`,
      top1Finishes: sql<number>`count(*) filter (where ${matchParticipants.placement} = 1)::int`,
      top3Finishes: sql<number>`count(*) filter (where ${matchParticipants.placement} <= 3)::int`,
      avgPlacement: sql<number>`avg(${matchParticipants.placement})::float`,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(sql`extract(hour from (${matches.gameCreation} at time zone 'UTC'))`));
  const teamRowsQuery = Promise.resolve(db
    .select({
      teamId: matchParticipants.teamId,
      top1: sql<number>`count(*) filter (where ${matchParticipants.placement} = 1)::int`,
      top3ExclTop1: sql<number>`count(*) filter (where ${matchParticipants.placement} between 2 and 3)::int`,
      remaining: sql<number>`count(*) filter (where ${matchParticipants.placement} > 3)::int`,
      avgPlacement: sql<number>`avg(${matchParticipants.placement})::float`,
      kills: sql<number>`coalesce(sum(${matchParticipants.kills}), 0)::int`,
      deaths: sql<number>`coalesce(sum(${matchParticipants.deaths}), 0)::int`,
      assists: sql<number>`coalesce(sum(${matchParticipants.assists}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.teamId));
  const ownMatchRowsQuery = Promise.resolve(db
    .select({
      matchId: matchParticipants.matchId,
      teamId: matchParticipants.teamId,
      placement: matchParticipants.placement,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const banRowsQuery = Promise.resolve(db
    .select({
      matchId: matchParticipants.matchId,
      bannedChampionIds: matches.bannedChampionIds,
      placement: matchParticipants.placement,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const championRowsQuery = Promise.resolve(db
    .select({
      championId: matchParticipants.championId,
      championName: matchParticipants.championName,
      matchesPlayed: sql<number>`count(*)::int`,
      totalKills: sql<number>`coalesce(sum(${matchParticipants.kills}), 0)::int`,
      totalDeaths: sql<number>`coalesce(sum(${matchParticipants.deaths}), 0)::int`,
      totalAssists: sql<number>`coalesce(sum(${matchParticipants.assists}), 0)::int`,
      totalDamagePhysical: sql<number>`coalesce(sum(${matchParticipants.damageDealtToChampionsPhysical}), 0)::int`,
      totalDamageMagical: sql<number>`coalesce(sum(${matchParticipants.damageDealtToChampionsMagic}), 0)::int`,
      totalDamageTrue: sql<number>`coalesce(sum(${matchParticipants.damageDealtToChampionsTrue}), 0)::int`,
      totalDamageTakenPhysical: sql<number>`coalesce(sum(${matchParticipants.damageTakenPhysical}), 0)::int`,
      totalDamageTakenMagical: sql<number>`coalesce(sum(${matchParticipants.damageTakenMagic}), 0)::int`,
      totalDamageTakenTrue: sql<number>`coalesce(sum(${matchParticipants.damageTakenTrue}), 0)::int`,
      totalQCasts: sql<number>`coalesce(sum(${matchParticipants.qCasts}), 0)::int`,
      totalWCasts: sql<number>`coalesce(sum(${matchParticipants.wCasts}), 0)::int`,
      totalECasts: sql<number>`coalesce(sum(${matchParticipants.eCasts}), 0)::int`,
      totalRCasts: sql<number>`coalesce(sum(${matchParticipants.rCasts}), 0)::int`,
      totalSoloKills: sql<number>`coalesce(sum(${matchParticipants.soloKills}), 0)::int`,
      // Single-match records for the champion dossier's BEST GAME view —
      // independently maxed per field, see `ChampionKdaStats.mostKills`.
      mostKills: sql<number>`coalesce(max(${matchParticipants.kills}), 0)::int`,
      mostDeaths: sql<number>`coalesce(max(${matchParticipants.deaths}), 0)::int`,
      fewestDeaths: sql<number>`coalesce(min(${matchParticipants.deaths}), 0)::int`,
      mostAssists: sql<number>`coalesce(max(${matchParticipants.assists}), 0)::int`,
      mostSoloKills: sql<number>`coalesce(max(${matchParticipants.soloKills}), 0)::int`,
      mostDoubleKills: sql<number>`coalesce(max(${matchParticipants.doubleKills}), 0)::int`,
      mostTripleKills: sql<number>`coalesce(max(${matchParticipants.tripleKills}), 0)::int`,
      mostQuadraKills: sql<number>`coalesce(max(${matchParticipants.quadraKills}), 0)::int`,
      mostPentaKills: sql<number>`coalesce(max(${matchParticipants.pentaKills}), 0)::int`,
      bestDamageSelfMitigated: sql<number>`coalesce(max(${matchParticipants.damageSelfMitigated}), 0)::int`,
      mostItemsPurchased: sql<number>`coalesce(max(${matchParticipants.itemsPurchased}), 0)::int`,
      longestGameSeconds: sql<number>`coalesce(max(${matchParticipants.timePlayedSeconds}), 0)::int`,
      avgPlacement: sql<number>`coalesce(avg(${matchParticipants.placement}), 0)::float`,
      largestKillingSpree: sql<number>`coalesce(max(${matchParticipants.largestKillingSpree}), 0)::int`,
      totalHealingAndShielding: sql<number>`coalesce(sum(${matchParticipants.healingAndShielding}), 0)::int`,
      totalCcScoreSeconds: sql<number>`coalesce(sum(${matchParticipants.ccScoreSeconds}), 0)::int`,
      totalCcTimeDealt: sql<number>`coalesce(sum(${matchParticipants.ccTotalTimeDealt}), 0)::int`,
      totalSavesFromDeath: sql<number>`coalesce(sum(${matchParticipants.saveAllyFromDeath}), 0)::int`,
      // Same independently-maxed-per-field approach as `utilityAgg` above,
      // grouped by champion instead of the whole account.
      bestHealingAndShielding: sql<number>`coalesce(max(${matchParticipants.healingAndShielding}), 0)::int`,
      bestCcScoreSeconds: sql<number>`coalesce(max(${matchParticipants.ccScoreSeconds}), 0)::int`,
      bestCcTimeDealt: sql<number>`coalesce(max(${matchParticipants.ccTotalTimeDealt}), 0)::int`,
      bestSavesFromDeath: sql<number>`coalesce(max(${matchParticipants.saveAllyFromDeath}), 0)::int`,
      totalTimePlayedSeconds: sql<number>`coalesce(sum(${matchParticipants.timePlayedSeconds}), 0)::int`,
      // Multikills/burst records — sums, except the two `max` rows, which
      // are single-match bests (see `ChampionCombatStats`).
      totalDoubleKills: sql<number>`coalesce(sum(${matchParticipants.doubleKills}), 0)::int`,
      totalTripleKills: sql<number>`coalesce(sum(${matchParticipants.tripleKills}), 0)::int`,
      totalQuadraKills: sql<number>`coalesce(sum(${matchParticipants.quadraKills}), 0)::int`,
      totalPentaKills: sql<number>`coalesce(sum(${matchParticipants.pentaKills}), 0)::int`,
      largestCriticalStrike: sql<number>`coalesce(max(${matchParticipants.largestCriticalStrike}), 0)::int`,
      totalDamageSelfMitigated: sql<number>`coalesce(sum(${matchParticipants.damageSelfMitigated}), 0)::int`,
      totalGoldEarned: sql<number>`coalesce(sum(${matchParticipants.goldEarned}), 0)::int`,
      bestGoldEarned: sql<number>`coalesce(max(${matchParticipants.goldEarned}), 0)::int`,
      totalItemsPurchased: sql<number>`coalesce(sum(${matchParticipants.itemsPurchased}), 0)::int`,
      totalStatAnvils: sql<number>`coalesce(sum(${matchParticipants.statAnvilsBought}), 0)::int`,
      totalLegendaryAnvils: sql<number>`coalesce(sum(${matchParticipants.legendaryAnvilsBought}), 0)::int`,
      totalPrismaticAnvils: sql<number>`coalesce(sum(${matchParticipants.prismaticAnvilsBought}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.championId, matchParticipants.championName));
  const championPickRowsQuery = Promise.resolve(db
    .select({
      championId: matchParticipants.championId,
      championName: matchParticipants.championName,
      top1: sql<number>`count(*) filter (where ${matchParticipants.placement} = 1)::int`,
      top3ExclTop1: sql<number>`count(*) filter (where ${matchParticipants.placement} between 2 and 3)::int`,
      remaining: sql<number>`count(*) filter (where ${matchParticipants.placement} > 3)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.championId, matchParticipants.championName));
  const championBestGameRowsQuery = Promise.resolve(db
    .selectDistinctOn([matchParticipants.championId], {
      championId: matchParticipants.championId,
      kills: matchParticipants.kills,
      deaths: matchParticipants.deaths,
      assists: matchParticipants.assists,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(
      matchParticipants.championId,
      desc(sql`case when ${matchParticipants.deaths} = 0
        then (${matchParticipants.kills} + ${matchParticipants.assists})
        else (${matchParticipants.kills} + ${matchParticipants.assists})::float / ${matchParticipants.deaths}
      end`),
    ));
  // Every match's damage split, dealt and taken — the input to
  // `bestGamesByType` below (a few hundred small rows per summoner).
  const damageGameRowsQuery = Promise.resolve(db
    .select({
      championId: matchParticipants.championId,
      dealtPhysical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsPhysical}, 0)::int`,
      dealtMagical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsMagic}, 0)::int`,
      dealtTrue: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsTrue}, 0)::int`,
      takenPhysical: sql<number>`coalesce(${matchParticipants.damageTakenPhysical}, 0)::int`,
      takenMagical: sql<number>`coalesce(${matchParticipants.damageTakenMagic}, 0)::int`,
      takenTrue: sql<number>`coalesce(${matchParticipants.damageTakenTrue}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const championMaxDamageRowsQuery = Promise.resolve(db
    .selectDistinctOn([matchParticipants.championId], {
      championId: matchParticipants.championId,
      physical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsPhysical}, 0)::int`,
      magical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsMagic}, 0)::int`,
      trueDamage: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsTrue}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(matchParticipants.championId, desc(matchParticipants.damageDealtToChampions)));
  const championMaxDamageTakenRowsQuery = Promise.resolve(db
    .selectDistinctOn([matchParticipants.championId], {
      championId: matchParticipants.championId,
      physical: sql<number>`coalesce(${matchParticipants.damageTakenPhysical}, 0)::int`,
      magical: sql<number>`coalesce(${matchParticipants.damageTakenMagic}, 0)::int`,
      trueDamage: sql<number>`coalesce(${matchParticipants.damageTakenTrue}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(
      matchParticipants.championId,
      desc(sql`coalesce(${matchParticipants.damageTakenPhysical}, 0)
        + coalesce(${matchParticipants.damageTakenMagic}, 0)
        + coalesce(${matchParticipants.damageTakenTrue}, 0)`),
    ));
  const championMaxAbilityRowsQuery = Promise.resolve(db
    .selectDistinctOn([matchParticipants.championId], {
      championId: matchParticipants.championId,
      q: sql<number>`coalesce(${matchParticipants.qCasts}, 0)::int`,
      w: sql<number>`coalesce(${matchParticipants.wCasts}, 0)::int`,
      e: sql<number>`coalesce(${matchParticipants.eCasts}, 0)::int`,
      r: sql<number>`coalesce(${matchParticipants.rCasts}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(
      matchParticipants.championId,
      desc(sql`coalesce(${matchParticipants.qCasts}, 0)
        + coalesce(${matchParticipants.wCasts}, 0)
        + coalesce(${matchParticipants.eCasts}, 0)
        + coalesce(${matchParticipants.rCasts}, 0)`),
    ));
  const championMaxAnvilRowsQuery = Promise.resolve(db
    .selectDistinctOn([matchParticipants.championId], {
      championId: matchParticipants.championId,
      stat: sql<number>`coalesce(${matchParticipants.statAnvilsBought}, 0)::int`,
      legendary: sql<number>`coalesce(${matchParticipants.legendaryAnvilsBought}, 0)::int`,
      prismatic: sql<number>`coalesce(${matchParticipants.prismaticAnvilsBought}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(
      matchParticipants.championId,
      desc(sql`coalesce(${matchParticipants.statAnvilsBought}, 0)
        + coalesce(${matchParticipants.legendaryAnvilsBought}, 0)
        + coalesce(${matchParticipants.prismaticAnvilsBought}, 0)`),
    ));
  const championPlacementRowsQuery = Promise.resolve(db
    .select({
      championId: matchParticipants.championId,
      placement: matchParticipants.placement,
      count: sql<number>`count(*)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.championId, matchParticipants.placement));
  const augmentRowsQuery = Promise.resolve(db
    .select({
      augments: matchParticipants.augments,
      placement: matchParticipants.placement,
      championId: matchParticipants.championId,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const itemRowsQuery = Promise.resolve(db
    .select({
      items: matchParticipants.items,
      placement: matchParticipants.placement,
      championId: matchParticipants.championId,
      bootsBought: matchParticipants.bootsBought,
      bootsSold: matchParticipants.bootsSold,
      purchasedItemIds: matchParticipants.purchasedItemIds,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const teammateParticipant = alias(matchParticipants, "teammate_participant");
  const opponentParticipant = alias(matchParticipants, "opponent_participant");
  const teammateRowsQuery = Promise.resolve(db
    .select({
      matchId: matchParticipants.matchId,
      teamId: matchParticipants.teamId,
      championId: matchParticipants.championId,
      championName: matchParticipants.championName,
      puuid: matchParticipants.puuid,
    })
    .from(matchParticipants)
    .where(
      inArray(matchParticipants.matchId, db.select({ matchId: matchParticipants.matchId }).from(matchParticipants).where(eq(matchParticipants.puuid, summoner.puuid))),
    ));
  const teammateAggRowsQuery = Promise.resolve(db
    .select({
      puuid: teammateParticipant.puuid,
      gamesPlayed: sql<number>`count(*)::int`,
      top1: sql<number>`count(*) filter (where ${matchParticipants.placement} = 1)::int`,
      top3ExclTop1: sql<number>`count(*) filter (where ${matchParticipants.placement} between 2 and 3)::int`,
      remaining: sql<number>`count(*) filter (where ${matchParticipants.placement} > 3)::int`,
    })
    .from(matchParticipants)
    .innerJoin(
      teammateParticipant,
      and(
        eq(teammateParticipant.matchId, matchParticipants.matchId),
        eq(teammateParticipant.teamId, matchParticipants.teamId),
      ),
    )
    .where(
      and(
        eq(matchParticipants.puuid, summoner.puuid),
        sql`${teammateParticipant.puuid} <> ${summoner.puuid}`,
      ),
    )
    .groupBy(teammateParticipant.puuid));
  const teammateNameRowsQuery = Promise.resolve(db
    .selectDistinctOn([teammateParticipant.puuid], {
      puuid: teammateParticipant.puuid,
      riotIdGameName: teammateParticipant.riotIdGameName,
      riotIdTagline: teammateParticipant.riotIdTagline,
    })
    .from(matchParticipants)
    .innerJoin(
      teammateParticipant,
      and(
        eq(teammateParticipant.matchId, matchParticipants.matchId),
        eq(teammateParticipant.teamId, matchParticipants.teamId),
      ),
    )
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(
      and(
        eq(matchParticipants.puuid, summoner.puuid),
        sql`${teammateParticipant.puuid} <> ${summoner.puuid}`,
      ),
    )
    .orderBy(teammateParticipant.puuid, desc(matches.gameCreation)));
  const opponentAggRowsQuery = Promise.resolve(db
    .select({
      puuid: opponentParticipant.puuid,
      gamesFaced: sql<number>`count(*)::int`,
      top1: sql<number>`count(*) filter (where ${opponentParticipant.placement} = 1)::int`,
      top3ExclTop1: sql<number>`count(*) filter (where ${opponentParticipant.placement} between 2 and 3)::int`,
      remaining: sql<number>`count(*) filter (where ${opponentParticipant.placement} > 3)::int`,
      // Mirror of the above, but the summoner's OWN placement in these same
      // shared matches rather than the opponent's.
      ownTop1: sql<number>`count(*) filter (where ${matchParticipants.placement} = 1)::int`,
      ownTop3ExclTop1: sql<number>`count(*) filter (where ${matchParticipants.placement} between 2 and 3)::int`,
      // Head-to-head record: compares the summoner's OWN team placement
      // (matchParticipants.placement) against this opponent's team
      // placement in the same match — a lower placement is better (1st
      // beats 2nd, etc.), so "beat" means the summoner's number is
      // smaller.
      timesBeat: sql<number>`count(*) filter (where ${matchParticipants.placement} < ${opponentParticipant.placement})::int`,
      timesBeatenBy: sql<number>`count(*) filter (where ${matchParticipants.placement} > ${opponentParticipant.placement})::int`,
    })
    .from(matchParticipants)
    .innerJoin(
      opponentParticipant,
      and(
        eq(opponentParticipant.matchId, matchParticipants.matchId),
        sql`${opponentParticipant.teamId} <> ${matchParticipants.teamId}`,
      ),
    )
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(opponentParticipant.puuid));
  // Duels against each opponent, from `match_rounds` (see parseRounds()):
  // every duel the summoner's team fought, joined to the players on the
  // other side of it. Matches without a timeline contribute no rows, so
  // these can be 0 even when gamesFaced isn't.
  // Round duels fought alongside each teammate — same `match_rounds` join
  // as the opponent version below, but on the summoner's own side.
  const teammateRoundRowsQuery = Promise.resolve(db
    .select({
      puuid: teammateParticipant.puuid,
      roundsWon: sql<number>`count(*) filter (where ${matchRounds.winnerTeamId} = ${matchParticipants.teamId})::int`,
      roundsLost: sql<number>`count(*) filter (where ${matchRounds.loserTeamId} = ${matchParticipants.teamId})::int`,
    })
    .from(matchParticipants)
    .innerJoin(
      matchRounds,
      and(
        eq(matchRounds.matchId, matchParticipants.matchId),
        sql`${matchParticipants.teamId} in (${matchRounds.winnerTeamId}, ${matchRounds.loserTeamId})`,
      ),
    )
    .innerJoin(
      teammateParticipant,
      and(
        eq(teammateParticipant.matchId, matchParticipants.matchId),
        eq(teammateParticipant.teamId, matchParticipants.teamId),
        sql`${teammateParticipant.puuid} <> ${summoner.puuid}`,
      ),
    )
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(teammateParticipant.puuid));
  const opponentRoundRowsQuery = Promise.resolve(db
    .select({
      puuid: opponentParticipant.puuid,
      roundsWon: sql<number>`count(*) filter (where ${matchRounds.winnerTeamId} = ${matchParticipants.teamId})::int`,
      roundsLost: sql<number>`count(*) filter (where ${matchRounds.loserTeamId} = ${matchParticipants.teamId})::int`,
    })
    .from(matchParticipants)
    .innerJoin(
      matchRounds,
      and(
        eq(matchRounds.matchId, matchParticipants.matchId),
        sql`${matchParticipants.teamId} in (${matchRounds.winnerTeamId}, ${matchRounds.loserTeamId})`,
      ),
    )
    .innerJoin(
      opponentParticipant,
      and(
        eq(opponentParticipant.matchId, matchParticipants.matchId),
        sql`${opponentParticipant.teamId} = case when ${matchRounds.winnerTeamId} = ${matchParticipants.teamId} then ${matchRounds.loserTeamId} else ${matchRounds.winnerTeamId} end`,
      ),
    )
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(opponentParticipant.puuid));
  // Versus: the same duel join as `opponentRoundRowsQuery`, grouped by the
  // enemy champion instead of the enemy player.
  const versusChampionRowsQuery = Promise.resolve(db
    .select({
      championId: opponentParticipant.championId,
      championName: opponentParticipant.championName,
      duelsWon: sql<number>`count(*) filter (where ${matchRounds.winnerTeamId} = ${matchParticipants.teamId})::int`,
      duelsLost: sql<number>`count(*) filter (where ${matchRounds.loserTeamId} = ${matchParticipants.teamId})::int`,
      gamesFaced: sql<number>`count(distinct ${matchParticipants.matchId})::int`,
    })
    .from(matchParticipants)
    .innerJoin(
      matchRounds,
      and(
        eq(matchRounds.matchId, matchParticipants.matchId),
        sql`${matchParticipants.teamId} in (${matchRounds.winnerTeamId}, ${matchRounds.loserTeamId})`,
      ),
    )
    .innerJoin(
      opponentParticipant,
      and(
        eq(opponentParticipant.matchId, matchParticipants.matchId),
        sql`${opponentParticipant.teamId} = case when ${matchRounds.winnerTeamId} = ${matchParticipants.teamId} then ${matchRounds.loserTeamId} else ${matchRounds.winnerTeamId} end`,
      ),
    )
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(opponentParticipant.championId, opponentParticipant.championName));
  // Every duel once, for the season total (the per-champion rows count a
  // duel once per enemy on the other team).
  const duelTotalsQuery = Promise.resolve(db
    .select({
      duelsWon: sql<number>`count(*) filter (where ${matchRounds.winnerTeamId} = ${matchParticipants.teamId})::int`,
      duelsLost: sql<number>`count(*) filter (where ${matchRounds.loserTeamId} = ${matchParticipants.teamId})::int`,
    })
    .from(matchParticipants)
    .innerJoin(
      matchRounds,
      and(
        eq(matchRounds.matchId, matchParticipants.matchId),
        sql`${matchParticipants.teamId} in (${matchRounds.winnerTeamId}, ${matchRounds.loserTeamId})`,
      ),
    )
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  const opponentNameRowsQuery = Promise.resolve(db
    .selectDistinctOn([opponentParticipant.puuid], {
      puuid: opponentParticipant.puuid,
      riotIdGameName: opponentParticipant.riotIdGameName,
      riotIdTagline: opponentParticipant.riotIdTagline,
    })
    .from(matchParticipants)
    .innerJoin(
      opponentParticipant,
      and(
        eq(opponentParticipant.matchId, matchParticipants.matchId),
        sql`${opponentParticipant.teamId} <> ${matchParticipants.teamId}`,
      ),
    )
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(opponentParticipant.puuid, desc(matches.gameCreation)));
  const pickRowsQuery = Promise.resolve(db
    .selectDistinct({
      matchId: matchParticipants.matchId,
      championId: matchParticipants.championId,
    })
    .from(matchParticipants)
    .where(
      inArray(matchParticipants.matchId, db.select({ matchId: matchParticipants.matchId }).from(matchParticipants).where(eq(matchParticipants.puuid, summoner.puuid))),
    ));
  const championNameRowsQuery = Promise.resolve(db
    .selectDistinct({
      championId: matchParticipants.championId,
      championName: matchParticipants.championName,
    })
    .from(matchParticipants));
  const summonerSpellRowsQuery = Promise.resolve(db
    .select({
      championId: matchParticipants.championId,
      championName: matchParticipants.championName,
      spell1Id: matchParticipants.summonerSpell1Id,
      spell1Casts: matchParticipants.summonerSpell1Casts,
      spell2Id: matchParticipants.summonerSpell2Id,
      spell2Casts: matchParticipants.summonerSpell2Casts,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid)));
  // `frames` is stored as the damage curve's own `[t, phys, magic, true]`
  // tuples, so it's read as-is.
  const damageCurveRowsQuery = Promise.resolve(db
    .select({
      matchId: matchParticipants.matchId,
      championId: matchParticipants.championId,
      championName: matchParticipants.championName,
      placement: matchParticipants.placement,
      timePlayedSeconds: matchParticipants.timePlayedSeconds,
      // Non-null: the `where` below skips rows without frames.
      frames: sql<DamageCurveGameRow["frames"]>`${matchParticipants.frames}`,
    })
    .from(matchParticipants)
    .where(and(eq(matchParticipants.puuid, summoner.puuid), sql`${matchParticipants.frames} is not null`)));
  for (const query of [summonerSpellRowsQuery, damageCurveRowsQuery, teammateRowsQuery, teammateAggRowsQuery, teammateRoundRowsQuery, teammateNameRowsQuery, opponentAggRowsQuery, opponentRoundRowsQuery, versusChampionRowsQuery, duelTotalsQuery, opponentNameRowsQuery, pickRowsQuery, championNameRowsQuery, aggQuery, globalMaxDamageGameQuery, globalMaxDamageTakenGameQuery, killsAggQuery, economyAggQuery, utilityAggQuery, abilityAggQuery, globalMaxAbilityGameQuery, funAggQuery, pingsRowsQuery, placementRowsQuery, placementByMatchRowsQuery, calendarRowsQuery, hourRowsQuery, teamRowsQuery, ownMatchRowsQuery, banRowsQuery, championRowsQuery, championPickRowsQuery, championBestGameRowsQuery, championMaxDamageRowsQuery, championMaxDamageTakenRowsQuery, damageGameRowsQuery, championMaxAbilityRowsQuery, championMaxAnvilRowsQuery, championPlacementRowsQuery, augmentRowsQuery, itemRowsQuery]) {
    query.catch(() => {});
  }

  const [agg] = await aggQuery;

  const kda = agg.deaths === 0 ? agg.kills + agg.assists : (agg.kills + agg.assists) / agg.deaths;

  // The single tracked match with the highest total damage to champions —
  // ORDER BY + LIMIT 1 rather than independently MAX()-ing each damage
  // type column, since those maxes could come from different matches;
  // physical/magical/trueDamage below must all come from the same row.
  const [globalMaxDamageGame] = await globalMaxDamageGameQuery;
  const noDamage: DamageBreakdown = { physical: 0, magical: 0, trueDamage: 0 };

  // Same as globalMaxDamageGame but for damage *taken* — there's no combined
  // "total damage taken" column to ORDER BY (unlike damageDealtToChampions),
  // so the three nullable sub-columns are coalesced and summed directly in
  // the ORDER BY expression.
  const [globalMaxDamageTakenGame] = await globalMaxDamageTakenGameQuery;

  const [killsAgg] = await killsAggQuery;

  const [economyAgg] = await economyAggQuery;

  const [utilityAgg] = await utilityAggQuery;

  const [abilityAgg] = await abilityAggQuery;

  // Same "no combined total column" situation as damage taken — order by
  // the coalesced sum of all four cast columns directly.
  const [globalMaxAbilityGame] = await globalMaxAbilityGameQuery;
  const noAbility: AbilityCastBreakdown = { q: 0, w: 0, e: 0, r: 0 };

  const [funAgg] = await funAggQuery;

  // `pings` is one jsonb object per row (14 named counters — see CLAUDE.md
  // §2), not a column per type, so summing per-type needs a JS reduce
  // rather than a single SQL sum(). Also builds `totalPings` (every type
  // combined) in the same pass rather than a second query.
  const pingsRows = await pingsRowsQuery;

  const pingTypes = [
    "allIn", "assistMe", "basic", "command", "danger", "enemyMissing", "enemyVision",
    "getBack", "hold", "needVision", "onMyWay", "push", "retreat", "visionCleared",
  ] as const satisfies readonly (keyof PingBreakdown)[];
  const pingTotals: PingBreakdown = {
    allIn: 0, assistMe: 0, basic: 0, command: 0, danger: 0, enemyMissing: 0, enemyVision: 0,
    getBack: 0, hold: 0, needVision: 0, onMyWay: 0, push: 0, retreat: 0, visionCleared: 0,
  };
  let totalPings = 0;
  for (const row of pingsRows) {
    if (!row.pings) continue;
    for (const type of pingTypes) {
      const value = row.pings[type] ?? 0;
      pingTotals[type] += value;
      totalPings += value;
    }
  }

  // Grouped rather than hardcoded 1..6 — Arena's team count (and therefore
  // the range of possible placements) has changed before (see CLAUDE.md §2).
  const placementRows = await placementRowsQuery;

  // Zero-filled from 1 up to the worst placement actually seen, so a
  // placement the summoner never finished in (e.g. no 1st places yet) still
  // gets its own column instead of every later placement shifting left.
  // The range comes from the data, not a hardcoded team count (CLAUDE.md §2).
  const byPlacement: Record<number, number> = {};
  const worstOwnPlacement = Math.max(0, ...placementRows.map((row) => row.placement));
  for (let placement = 1; placement <= worstOwnPlacement; placement++) {
    byPlacement[placement] = 0;
  }
  for (const row of placementRows) {
    byPlacement[row.placement] = row.count;
  }

  // What a typical game at each finishing place looks like, for the
  // placement chart's hover card.
  const placementChampionRows = await placementChampionRowsQuery;
  // The champion whose games end at this place most often, as a share of
  // that champion's own games — the plain most-played champion is just the
  // summoner's main at every placement. Same minimum sample as the web's
  // `lib/sample.ts` (5), so a one-game champion can't claim 100%.
  const gamesByChampion = new Map<string, number>();
  for (const row of placementChampionRows) {
    gamesByChampion.set(row.championName, (gamesByChampion.get(row.championName) ?? 0) + row.count);
  }
  const topChampionByPlacement = new Map<number, NonNullable<PlacementDetail["topChampion"]>>();
  for (const row of placementChampionRows) {
    const totalGames = gamesByChampion.get(row.championName) ?? 0;
    if (totalGames < 5) continue;
    const current = topChampionByPlacement.get(row.placement);
    const rate = row.count / totalGames;
    const currentRate = current ? current.games / current.totalGames : -1;
    if (
      rate > currentRate ||
      (current && rate === currentRate && row.count > current.games)
    ) {
      topChampionByPlacement.set(row.placement, {
        championName: row.championName,
        games: row.count,
        totalGames,
      });
    }
  }
  const detailsByPlacement: Record<number, PlacementDetail> = {};
  for (const row of placementRows) {
    detailsByPlacement[row.placement] = {
      avgGameSeconds: row.avgGameSeconds,
      kda: (row.kills + row.assists) / Math.max(1, row.deaths),
      avgDamage: row.avgDamage,
      avgAugments: row.avgAugments,
      topChampion: topChampionByPlacement.get(row.placement) ?? null,
    };
  }

  // Longest run of consecutive tracked matches (chronological, not calendar
  // days) finishing top3 ("win", same definition as `top3Finishes`) or top1 —
  // same running-streak approach as the calendar-day streak below, just
  // walked over match order instead of distinct days.
  const placementByMatchRows = await placementByMatchRowsQuery;

  let longestWinStreak = 0;
  let currentWinStreak = 0;
  let longestTop1Streak = 0;
  let currentTop1Streak = 0;
  for (const row of placementByMatchRows) {
    currentWinStreak = row.placement <= 3 ? currentWinStreak + 1 : 0;
    longestWinStreak = Math.max(longestWinStreak, currentWinStreak);

    currentTop1Streak = row.placement === 1 ? currentTop1Streak + 1 : 0;
    longestTop1Streak = Math.max(longestTop1Streak, currentTop1Streak);
  }
  const lastPlacementRow = placementByMatchRows[placementByMatchRows.length - 1];
  const lastMatchAt = lastPlacementRow ? lastPlacementRow.gameCreation.toISOString() : null;
  const recentPlacements = placementByMatchRows
    .slice(-RECENT_PLACEMENTS_COUNT)
    .reverse()
    .map((row) => row.placement);

  // The same walk per champion, for the dossier's form chart (every match).
  const formByChampionName = new Map<string, ChampionFormStats>();
  for (const row of placementByMatchRows) {
    let form = formByChampionName.get(row.championName);
    if (!form) {
      form = { games: [], currentWinStreak: 0, longestWinStreak: 0 };
      formByChampionName.set(row.championName, form);
    }
    form.currentWinStreak = row.placement <= 3 ? form.currentWinStreak + 1 : 0;
    form.longestWinStreak = Math.max(form.longestWinStreak, form.currentWinStreak);
    form.games.unshift({
      placement: row.placement,
      playedAt: row.gameCreation.toISOString(),
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
    });
  }

  // Grouped by UTC calendar day (see CalendarDayStats's doc comment on why
  // UTC — a deliberate simplification, not the player's own timezone) for
  // the summoner page's activity calendar.
  const calendarRows = await calendarRowsQuery;

  // Per-day and per-hour extras for the calendar and hour-chart hover cards,
  // walked from the chronological per-match rows already loaded above
  // (bucketed in UTC, like the SQL groupings).
  type HoverBucket = {
    placements: number[];
    kills: number;
    deaths: number;
    assists: number;
    timePlayedSeconds: number;
    timedGames: number;
    championGames: Map<string, number>;
  };
  const newBucket = (): HoverBucket => ({
    placements: [],
    kills: 0,
    deaths: 0,
    assists: 0,
    timePlayedSeconds: 0,
    timedGames: 0,
    championGames: new Map(),
  });
  const addToBucket = (bucket: HoverBucket, row: (typeof placementByMatchRows)[number]) => {
    bucket.placements.push(row.placement);
    bucket.kills += row.kills;
    bucket.deaths += row.deaths;
    bucket.assists += row.assists;
    if (row.timePlayedSeconds != null) {
      bucket.timePlayedSeconds += row.timePlayedSeconds;
      bucket.timedGames += 1;
    }
    bucket.championGames.set(row.championName, (bucket.championGames.get(row.championName) ?? 0) + 1);
  };
  const bucketKda = (bucket: HoverBucket) =>
    (bucket.kills + bucket.assists) / Math.max(1, bucket.deaths);
  const TOP_CHAMPIONS_COUNT = 3;
  const bucketTopChampions = (bucket: HoverBucket): ChampionGames[] =>
    [...bucket.championGames]
      .map(([championName, games]) => ({ championName, games }))
      .sort((a, b) => b.games - a.games || a.championName.localeCompare(b.championName))
      .slice(0, TOP_CHAMPIONS_COUNT);
  const dayBuckets = new Map<string, HoverBucket>();
  const hourBuckets = Array.from({ length: 24 }, newBucket);
  for (const row of placementByMatchRows) {
    const date = row.gameCreation.toISOString().slice(0, 10);
    let dayBucket = dayBuckets.get(date);
    if (!dayBucket) dayBuckets.set(date, (dayBucket = newBucket()));
    addToBucket(dayBucket, row);
    addToBucket(hourBuckets[row.gameCreation.getUTCHours()], row);
  }

  const calendarDays: CalendarDayStats[] = calendarRows.map((row) => {
    const bucket = dayBuckets.get(row.date) ?? newBucket();
    return {
      date: row.date,
      gamesPlayed: row.gamesPlayed,
      top3Rate: (row.top3Finishes / row.gamesPlayed) * 100,
      avgPlacement: row.avgPlacement,
      bestPlacement: row.bestPlacement,
      timePlayedSeconds: row.timePlayedSeconds,
      top1Finishes: bucket.placements.filter((placement) => placement === 1).length,
      top3Finishes: row.top3Finishes,
      kda: bucketKda(bucket),
      placements: bucket.placements,
      champions: bucketTopChampions(bucket),
    };
  });
  const kdaByHour = hourBuckets.map((bucket) =>
    bucket.placements.length > 0 ? bucketKda(bucket) : null,
  );
  const avgGameSecondsByHour = hourBuckets.map((bucket) =>
    bucket.timedGames > 0 ? bucket.timePlayedSeconds / bucket.timedGames : null,
  );
  const championsByHour = hourBuckets.map(bucketTopChampions);

  // Tracked matches grouped by UTC hour-of-day, for the "by hour" activity
  // view — not derived from `calendarDays` (grouped by date, not time of
  // day), so its own query.
  const hourRows = await hourRowsQuery;

  const gamesByHour = new Array<number>(24).fill(0);
  const top1ByHour = new Array<number>(24).fill(0);
  const top3ByHour = new Array<number>(24).fill(0);
  const avgPlacementByHour = new Array<number | null>(24).fill(null);
  for (const row of hourRows) {
    gamesByHour[row.hour] = row.gamesPlayed;
    top1ByHour[row.hour] = row.top1Finishes;
    top3ByHour[row.hour] = row.top3Finishes;
    avgPlacementByHour[row.hour] = row.avgPlacement;
  }

  const mostGamesInADay = calendarDays.reduce(
    (max, day) => Math.max(max, day.gamesPlayed),
    0,
  );

  // Longest run of consecutive UTC calendar days with at least one tracked
  // match — walked once over the same per-day rows already grouped above,
  // sorted ascending, comparing each day to the previous one. The streak
  // still standing when the loop reaches the most recent tracked day is
  // also that day's "current streak" length, reused below.
  let longestStreakDays = 0;
  let streakEndingOnLastTrackedDay = 0;
  let previousStreakDate: Date | null = null;
  let lastTrackedDate: Date | null = null;
  for (const date of [...calendarDays].map((d) => d.date).sort()) {
    const current = new Date(`${date}T00:00:00Z`);
    streakEndingOnLastTrackedDay =
      previousStreakDate &&
      current.getTime() - previousStreakDate.getTime() === 86_400_000
        ? streakEndingOnLastTrackedDay + 1
        : 1;
    longestStreakDays = Math.max(longestStreakDays, streakEndingOnLastTrackedDay);
    previousStreakDate = current;
    lastTrackedDate = current;
  }

  // A streak only reads as "current" if the most recent tracked day is
  // today or yesterday (UTC) — otherwise it's just history, so it reports 0
  // rather than a stale run from weeks ago.
  const todayUtc = new Date();
  const todayUtcMidnight = new Date(
    Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()),
  );
  const daysSinceLastMatch = lastTrackedDate
    ? Math.round((todayUtcMidnight.getTime() - lastTrackedDate.getTime()) / 86_400_000)
    : null;
  const currentStreakDays =
    daysSinceLastMatch !== null && daysSinceLastMatch <= 1
      ? streakEndingOnLastTrackedDay
      : 0;

  const WEEKDAY_NAMES = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];
  const gamesByWeekday = new Array<number>(7).fill(0);
  for (const day of calendarDays) {
    const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    gamesByWeekday[weekday] += day.gamesPlayed;
  }
  let favoriteDayOfWeek: string | null = null;
  let mostGamesOnAWeekday = 0;
  for (let weekday = 0; weekday < 7; weekday++) {
    if (gamesByWeekday[weekday] > mostGamesOnAWeekday) {
      mostGamesOnAWeekday = gamesByWeekday[weekday];
      favoriteDayOfWeek = WEEKDAY_NAMES[weekday];
    }
  }

  // `teamId` is the lobby slot the summoner started each match in (Riot's
  // playerSubteamId) — an arbitrary per-match label, not a durable identity,
  // grouped here purely to see whether any slot skews toward better/worse
  // outcomes. Not hardcoded to 1..6 for the same reason as `byPlacement`.
  const teamRows = await teamRowsQuery;
  // Finishes at every exact placement per slot, for the hover card — from the
  // summoner's own per-match rows rather than another grouped query.
  const byPlacementByTeam = new Map<number, Record<number, number>>();
  for (const row of await ownMatchRowsQuery) {
    let counts = byPlacementByTeam.get(row.teamId);
    if (!counts) byPlacementByTeam.set(row.teamId, (counts = {}));
    counts[row.placement] = (counts[row.placement] ?? 0) + 1;
  }

  const byTeamId: TeamSlotBreakdown[] = teamRows
    .map((row) => ({
      teamId: row.teamId,
      top1: row.top1,
      top3ExclTop1: row.top3ExclTop1,
      remaining: row.remaining,
      avgPlacement: row.avgPlacement,
      kda: (row.kills + row.assists) / Math.max(1, row.deaths),
      byPlacement: byPlacementByTeam.get(row.teamId) ?? {},
    }))
    .sort((a, b) => a.teamId - b.teamId);

  // Team synergy: which champions have shared the tracked summoner's Arena
  // team, and how well specific pairings have performed. `teamId` (Riot's
  // playerSubteamId) is only a per-match label, not a durable identity
  // across matches (see CLAUDE.md §2), so team membership has to be
  // re-derived per match rather than joined on teamId alone — fetch every
  // participant row from the summoner's own tracked matches, then filter in
  // JS to whichever teamId the summoner was actually on THAT match, the same
  // "fetch broad, group in JS" approach `pickRows`/`pickedChampionsByMatch`
  // above use for bans.
  const ownMatchRows = await ownMatchRowsQuery;

  const ownTeamIdByMatch = new Map(ownMatchRows.map((r) => [r.matchId, r.teamId]));
  const placementByMatch = new Map(ownMatchRows.map((r) => [r.matchId, r.placement]));

  const teammateRows = await teammateRowsQuery;

  // One roster per match: every champion (the summoner's own pick included)
  // on the summoner's team that match, deduped by championId in case the
  // same champion ever ends up on a team twice (not observed, but the same
  // defensive dedupe every other per-match aggregation in this file uses).
  const rosterByMatch = new Map<string, Map<number, string>>();
  const ownChampionByMatch = new Map<string, { championId: number; championName: string }>();
  for (const row of teammateRows) {
    if (row.teamId !== ownTeamIdByMatch.get(row.matchId)) continue;
    if (row.puuid === summoner.puuid) {
      ownChampionByMatch.set(row.matchId, { championId: row.championId, championName: row.championName });
    }
    const roster = rosterByMatch.get(row.matchId) ?? new Map<number, string>();
    roster.set(row.championId, row.championName);
    rosterByMatch.set(row.matchId, roster);
  }

  const gamesOnTeamByChampion = new Map<number, number>();
  const championNameByChampionId = new Map<number, string>();
  type PairAgg = {
    aId: number;
    aName: string;
    bId: number;
    bName: string;
    games: number;
    top1: number;
    top3ExclTop1: number;
    remaining: number;
  };
  const pairAggByKey = new Map<string, PairAgg>();

  // Wins/1sts in the matches each champion was on the team, for the chord
  // arcs' hover card — same "win" definition as everywhere else (top 3).
  const winsOnTeamByChampion = new Map<number, { top1: number; top3: number }>();
  for (const [matchId, roster] of rosterByMatch) {
    const placement = placementByMatch.get(matchId)!;
    for (const [championId, championName] of roster) {
      gamesOnTeamByChampion.set(
        championId,
        (gamesOnTeamByChampion.get(championId) ?? 0) + 1,
      );
      const wins = winsOnTeamByChampion.get(championId) ?? { top1: 0, top3: 0 };
      if (placement === 1) wins.top1++;
      if (placement <= 3) wins.top3++;
      winsOnTeamByChampion.set(championId, wins);
      championNameByChampionId.set(championId, championName);
    }

    const championIds = [...roster.keys()];
    for (let i = 0; i < championIds.length; i++) {
      for (let j = i + 1; j < championIds.length; j++) {
        const idA = Math.min(championIds[i], championIds[j]);
        const idB = Math.max(championIds[i], championIds[j]);
        const key = `${idA}:${idB}`;
        const pair = pairAggByKey.get(key) ?? {
          aId: idA,
          aName: roster.get(idA)!,
          bId: idB,
          bName: roster.get(idB)!,
          games: 0,
          top1: 0,
          top3ExclTop1: 0,
          remaining: 0,
        };
        pair.games++;
        if (placement === 1) pair.top1++;
        else if (placement >= 2 && placement <= 3) pair.top3ExclTop1++;
        else pair.remaining++;
        pairAggByKey.set(key, pair);
      }
    }
  }

  function toPairStats(pair: PairAgg): TeamSynergyPairStats {
    return {
      championAId: pair.aId,
      championAName: pair.aName,
      championBId: pair.bId,
      championBName: pair.bName,
      gamesTogether: pair.games,
      top1: pair.top1,
      top3ExclTop1: pair.top3ExclTop1,
      remaining: pair.remaining,
      top3Rate: ((pair.top1 + pair.top3ExclTop1) / pair.games) * 100,
    };
  }

  // Teammates' champions (the summoner's own pick excluded) with the
  // summoner's finishes in those games: "which champions on my team go with
  // my best results". Own-champion x teammate-champion pairs were tried
  // first and are far too sparse to rank (1 of 589 pairs reached 5 games).
  const teammateChampionAgg = new Map<number, { championId: number; championName: string; games: number; top1: number; top3ExclTop1: number; remaining: number }>();
  for (const [matchId, roster] of rosterByMatch) {
    const own = ownChampionByMatch.get(matchId);
    const placement = placementByMatch.get(matchId)!;
    for (const [championId, championName] of roster) {
      if (own && championId === own.championId) continue;
      const agg = teammateChampionAgg.get(championId) ?? {
        championId,
        championName,
        games: 0,
        top1: 0,
        top3ExclTop1: 0,
        remaining: 0,
      };
      agg.games++;
      if (placement === 1) agg.top1++;
      else if (placement >= 2 && placement <= 3) agg.top3ExclTop1++;
      else agg.remaining++;
      teammateChampionAgg.set(championId, agg);
    }
  }

  const allPairs = [...pairAggByKey.values()];
  const mostPlayedPairing =
    allPairs.length > 0
      ? toPairStats(
          allPairs.reduce((best, p) => (p.games > best.games ? p : best)),
        )
      : null;
  const eligibleForBest = allPairs.filter(
    (p) => p.games >= TEAM_SYNERGY_MIN_PAIR_SAMPLE,
  );
  const bestPairing =
    eligibleForBest.length > 0
      ? toPairStats(
          eligibleForBest.reduce((best, p) =>
            (p.top1 + p.top3ExclTop1) / p.games >
            (best.top1 + best.top3ExclTop1) / best.games
              ? p
              : best,
          ),
        )
      : null;

  // The top `TEAM_SYNERGY_MAX_CHAMPIONS` get their own named arc; every
  // champion past that cap is folded into one aggregate "Other" arc rather
  // than dropped, so every champion the summoner has ever teamed with is
  // still represented somewhere on the chart (a chord diagram with 150+
  // individually-labeled arcs isn't legible, but silently truncating the
  // list makes the chart look like an incomplete picture of the team's
  // history) — `totalDistinctChampions`/`totalDistinctPairings` below report
  // the true, uncapped counts regardless.
  const sortedChampionIds = [...gamesOnTeamByChampion.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([championId]) => championId);
  const namedChampionIds = sortedChampionIds.slice(0, TEAM_SYNERGY_MAX_CHAMPIONS);
  const otherChampionIds = sortedChampionIds.slice(TEAM_SYNERGY_MAX_CHAMPIONS);

  // `-1` marks the aggregate node the same way Riot's own ban data uses `-1`
  // for "no champion" (see CLAUDE.md §2) — never a real champion id, so it
  // can't collide with one.
  const OTHER_CHAMPION_ID = -1;
  const teamSynergyChampions: TeamSynergyChampionNode[] = namedChampionIds.map(
    (championId) => ({
      championId,
      championName: championNameByChampionId.get(championId)!,
      gamesOnTeam: gamesOnTeamByChampion.get(championId)!,
      top1OnTeam: winsOnTeamByChampion.get(championId)?.top1 ?? 0,
      top3OnTeam: winsOnTeamByChampion.get(championId)?.top3 ?? 0,
      championCount: 1,
    }),
  );
  if (otherChampionIds.length > 0) {
    teamSynergyChampions.push({
      championId: OTHER_CHAMPION_ID,
      championName: "Other",
      gamesOnTeam: otherChampionIds.reduce(
        (sum, championId) => sum + gamesOnTeamByChampion.get(championId)!,
        0,
      ),
      top1OnTeam: otherChampionIds.reduce(
        (sum, championId) => sum + (winsOnTeamByChampion.get(championId)?.top1 ?? 0),
        0,
      ),
      top3OnTeam: otherChampionIds.reduce(
        (sum, championId) => sum + (winsOnTeamByChampion.get(championId)?.top3 ?? 0),
        0,
      ),
      championCount: otherChampionIds.length,
    });
  }

  // Every real champion id maps to a node index — either its own named arc,
  // or the shared "Other" arc's index (the last one, when it exists).
  const teamSynergyIndexById = new Map<number, number>();
  namedChampionIds.forEach((championId, index) =>
    teamSynergyIndexById.set(championId, index),
  );
  if (otherChampionIds.length > 0) {
    const otherIndex = namedChampionIds.length;
    for (const championId of otherChampionIds) {
      teamSynergyIndexById.set(championId, otherIndex);
    }
  }

  const emptyMatrix = () =>
    teamSynergyChampions.map(() => new Array<number>(teamSynergyChampions.length).fill(0));
  const teamSynergyMatrix: number[][] = emptyMatrix();
  const teamSynergyMatrixTop1: number[][] = emptyMatrix();
  const teamSynergyMatrixTop3: number[][] = emptyMatrix();
  for (const pair of allPairs) {
    const indexA = teamSynergyIndexById.get(pair.aId)!;
    const indexB = teamSynergyIndexById.get(pair.bId)!;
    // Both champions folded into the same "Other" arc — a ribbon needs two
    // DISTINCT arcs (see `TeamSynergyStats.matrix`'s doc comment), so this
    // pair's games aren't drawn as a ribbon; they're still reflected in
    // "Other"'s own `gamesOnTeam` and in `totalDistinctPairings` above.
    if (indexA === indexB) continue;
    // Unlike the uncapped 1:1 case, several distinct real pairs can now
    // collapse onto the same cell once one or both champions fold into
    // "Other" (e.g. two different rarely-played champions each paired with
    // the same top-16 champion both land on that champion's "Other" cell),
    // so this accumulates rather than assigning.
    teamSynergyMatrix[indexA][indexB] += pair.games;
    teamSynergyMatrix[indexB][indexA] += pair.games;
    teamSynergyMatrixTop1[indexA][indexB] += pair.top1;
    teamSynergyMatrixTop1[indexB][indexA] += pair.top1;
    teamSynergyMatrixTop3[indexA][indexB] += pair.top1 + pair.top3ExclTop1;
    teamSynergyMatrixTop3[indexB][indexA] += pair.top1 + pair.top3ExclTop1;
  }

  // Teammates — the actual Riot accounts (not champions) that have shared
  // the summoner's Arena team, self-joining match_participants on
  // (matchId, teamId) via a table alias since this is comparing rows within
  // the same table (see CLAUDE.md working conventions on why `alias` is
  // re-exported from @arena/db rather than apps/api depending on drizzle-orm
  // directly). A separate query from the champion-synergy one above (which
  // already fetches every teammate row but only keeps championId/
  // championName) since that one doesn't select puuid.

  const teammateAggRows = await teammateAggRowsQuery;

  // A teammate's Riot ID can change over time (unlike championName, which
  // never does) — DISTINCT ON + ORDER BY gameCreation desc picks the name
  // from their most recent shared match, the same "latest/best row per
  // group" pattern this file already uses for championBestGameRows etc.,
  // rather than an arbitrary one.
  const teammateNameRows = await teammateNameRowsQuery;
  const teammateNameByPuuid = new Map(
    teammateNameRows.map((row) => [row.puuid, row]),
  );

  const teammateRoundsByPuuid = new Map(
    (await teammateRoundRowsQuery).map((row) => [row.puuid, row]),
  );

  const teammates: TeammateStats[] = teammateAggRows
    .filter((row) => row.gamesPlayed >= MIN_SHARED_GAMES_LISTED)
    .map((row) => {
      const name = teammateNameByPuuid.get(row.puuid);
      return {
        puuid: row.puuid,
        riotIdGameName: name?.riotIdGameName ?? "Unknown",
        riotIdTagline: name?.riotIdTagline ?? "????",
        gamesPlayed: row.gamesPlayed,
        top1: row.top1,
        top3ExclTop1: row.top3ExclTop1,
        remaining: row.remaining,
        roundsWon: teammateRoundsByPuuid.get(row.puuid)?.roundsWon ?? 0,
        roundsLost: teammateRoundsByPuuid.get(row.puuid)?.roundsLost ?? 0,
      };
    })
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);

  // Nemesis — the "opposing team" counterpart to the teammates query above:
  // every Riot account that has shared a tracked match with the summoner on
  // a DIFFERENT team, self-joining match_participants on matchId with
  // `teamId <> teamId` instead of `teamId = teamId`. The self-join already
  // excludes the summoner themselves (their own row can't have a teamId
  // different from itself), so there's no separate puuid<>puuid filter
  // needed here the way the teammates query needs one.

  const opponentAggRows = await opponentAggRowsQuery;

  // Same "latest name wins" DISTINCT ON pattern as `teammateNameRows` above.
  const opponentNameRows = await opponentNameRowsQuery;
  const opponentNameByPuuid = new Map(
    opponentNameRows.map((row) => [row.puuid, row]),
  );

  const opponentRoundsByPuuid = new Map(
    (await opponentRoundRowsQuery).map((row) => [row.puuid, row]),
  );

  const opponents: OpponentStats[] = opponentAggRows
    .filter((row) => row.gamesFaced >= MIN_SHARED_GAMES_LISTED)
    .map((row) => {
      const name = opponentNameByPuuid.get(row.puuid);
      return {
        puuid: row.puuid,
        riotIdGameName: name?.riotIdGameName ?? "Unknown",
        riotIdTagline: name?.riotIdTagline ?? "????",
        gamesFaced: row.gamesFaced,
        top1: row.top1,
        top3ExclTop1: row.top3ExclTop1,
        remaining: row.remaining,
        ownTop1: row.ownTop1,
        ownTop3ExclTop1: row.ownTop3ExclTop1,
        timesBeat: row.timesBeat,
        timesBeatenBy: row.timesBeatenBy,
        roundsWon: opponentRoundsByPuuid.get(row.puuid)?.roundsWon ?? 0,
        roundsLost: opponentRoundsByPuuid.get(row.puuid)?.roundsLost ?? 0,
      };
    })
    .sort((a, b) => b.gamesFaced - a.gamesFaced);

  const versusChampions = (await versusChampionRowsQuery).sort(
    (a, b) => b.duelsWon + b.duelsLost - (a.duelsWon + a.duelsLost),
  );
  const [duelTotals] = await duelTotalsQuery;

  // Bans are lobby-wide, stored once per match on `matches.bannedChampionIds`
  // (see CLAUDE.md §2) — join to this summoner's matches to see which bans
  // they were exposed to. One row per tracked match, since match_participants
  // has exactly one row per (matchId, puuid).
  const banRows = await banRowsQuery;

  // Which champions were actually picked (by anyone, not just the tracked
  // summoner) in each of these matches — a champion merely being open isn't
  // enough to sample "win rate when open" from a match, since a champion
  // nobody picked can't have influenced that game's outcome at all.
  const pickRows = await pickRowsQuery;
  const pickedChampionsByMatch = new Map<string, Set<number>>();
  for (const { matchId, championId } of pickRows) {
    let set = pickedChampionsByMatch.get(matchId);
    if (!set) {
      set = new Set();
      pickedChampionsByMatch.set(matchId, set);
    }
    set.add(championId);
  }

  const matchBans = banRows.map((row) => ({
    // Dedupe per match — the same champion could appear more than once in
    // the ban list (see BannedChampionStats.banRate's doc comment), and
    // counting it twice per match would let a ban rate exceed 100%. Also
    // drop -1, which isn't a champion — verified against real data that
    // Riot fills a ban slot with -1 when that player didn't lock one in
    // (271 of 329 matches checked had at least one -1), not a parsing bug.
    bannedIds: new Set((row.bannedChampionIds ?? []).filter((id) => id > 0)),
    rawIds: row.bannedChampionIds ?? [],
    isTop3: row.placement <= 3,
    pickedChampionIds: pickedChampionsByMatch.get(row.matchId) ?? new Set<number>(),
  }));

  const banCounts = new Map<number, number>();
  for (const { bannedIds } of matchBans) {
    for (const championId of bannedIds) {
      banCounts.set(championId, (banCounts.get(championId) ?? 0) + 1);
    }
  }

  // Raw ban-slot totals across every tracked match, counting duplicates —
  // unlike `banCounts` above (deduped per match for `banRate`), this feeds
  // the "X BANS" detail figure and the sidebar's TOTAL BANS / NO BAN /
  // DUPLICATE BAN counters (see BannedChampionsStats's doc comment).
  let totalBans = 0;
  let noBanCount = 0;
  let duplicateBanCount = 0;
  const totalBansByChampion = new Map<number, number>();
  for (const { rawIds } of matchBans) {
    const perMatchCounts = new Map<number, number>();
    for (const id of rawIds) {
      if (id <= 0) {
        noBanCount++;
        continue;
      }
      totalBans++;
      totalBansByChampion.set(id, (totalBansByChampion.get(id) ?? 0) + 1);
      perMatchCounts.set(id, (perMatchCounts.get(id) ?? 0) + 1);
    }
    for (const count of perMatchCounts.values()) {
      duplicateBanCount += Math.max(count - 1, 0);
    }
  }

  const bannedChampionIds = [...banCounts.keys()];
  // Bans only give us champion IDs, not names. Prefer names seen in
  // match_participants (no extra fetch needed for the common case), falling
  // back to Data Dragon's champion list for anything never actually picked
  // in a tracked match — a champion banned in 100% of matches, for example,
  // can by definition never appear in match_participants.
  const championNameRows = await championNameRowsQuery;
  const championNameById = new Map(
    championNameRows.map((row) => [row.championId, row.championName]),
  );
  const missingNameIds = bannedChampionIds.filter((id) => !championNameById.has(id));
  if (missingNameIds.length > 0) {
    const dataDragonNames = await getChampionNamesById();
    for (const id of missingNameIds) {
      const name = dataDragonNames.get(id);
      if (name) championNameById.set(id, name);
    }
  }

  const bannedChampions: BannedChampionStats[] = bannedChampionIds
    .map((championId) => {
      let notBannedTotal = 0;
      let notBannedTop3 = 0;
      for (const { bannedIds, isTop3, pickedChampionIds } of matchBans) {
        if (!bannedIds.has(championId) && pickedChampionIds.has(championId)) {
          notBannedTotal++;
          if (isTop3) notBannedTop3++;
        }
      }
      return {
        championId,
        championName: championNameById.get(championId) ?? `Champion ${championId}`,
        banRate: (banCounts.get(championId)! / banRows.length) * 100,
        totalBans: totalBansByChampion.get(championId) ?? 0,
        winRateWhenNotBanned:
          notBannedTotal > 0 ? (notBannedTop3 / notBannedTotal) * 100 : null,
        gamesOpenAndPicked: notBannedTotal,
      };
    })
    .sort((a, b) => b.banRate - a.banRate);

  const championRows = await championRowsQuery;

  // Same top1/top3ExclTop1/remaining split as `teamRows` above, grouped by
  // champion instead of lobby slot — how well each champion this summoner
  // has actually played tends to finish.
  const championPickRows = await championPickRowsQuery;

  const championPicks: ChampionPickBreakdown[] = championPickRows
    .map((row) => ({
      championId: row.championId,
      championName: row.championName,
      timesPicked: row.top1 + row.top3ExclTop1 + row.remaining,
      top1: row.top1,
      top3ExclTop1: row.top3ExclTop1,
      remaining: row.remaining,
    }))
    .sort((a, b) => b.timesPicked - a.timesPicked);

  // One row per champion: the single best-KDA match played on that champion
  // — kills/deaths/assists all come from that SAME row (see
  // ChampionKdaStats.bestGame's doc comment for why, as opposed to
  // independently maxing each stat). Same DISTINCT ON "top-1 row per group"
  // pattern as championMaxDamageRows below.
  const championBestGameRows = await championBestGameRowsQuery;

  const championBestGameById = new Map(
    championBestGameRows.map((row) => [
      row.championId,
      { kills: row.kills, deaths: row.deaths, assists: row.assists },
    ]),
  );
  const noBestGame = { kills: 0, deaths: 0, assists: 0 };

  // One row per champion: the single highest-damage match played on that
  // champion. Postgres's DISTINCT ON needs its leading ORDER BY column(s)
  // to match the DISTINCT ON list exactly, with the tie-breaker after —
  // this is the standard "top-1 row per group" pattern, picking the same
  // per-champion "best game" row the left-hand chart's icons line up with.
  const championMaxDamageRows = await championMaxDamageRowsQuery;

  const championMaxDamageById = new Map(
    championMaxDamageRows.map((row) => [
      row.championId,
      { physical: row.physical, magical: row.magical, trueDamage: row.trueDamage },
    ]),
  );

  // Same DISTINCT ON pattern as championMaxDamageRows, but for damage taken —
  // ordered by the same coalesced-sum expression as globalMaxDamageTakenGame
  // since there's no combined "total damage taken" column to order by.
  const championMaxDamageTakenRows = await championMaxDamageTakenRowsQuery;

  const championMaxDamageTakenById = new Map(
    championMaxDamageTakenRows.map((row) => [
      row.championId,
      { physical: row.physical, magical: row.magical, trueDamage: row.trueDamage },
    ]),
  );

  // For each damage type, the whole breakdown of the one game where that type
  // peaked — per champion and account-wide, dealt and taken. BEST GAME views
  // sorted by PHYS/MAGIC/TRUE show that game, never a mix of per-type maxima
  // from different games.
  const damageGameRows = await damageGameRowsQuery;
  type DamageGame = { dealt: DamageBreakdown; taken: DamageBreakdown };
  const bestGamesByType = (games: readonly DamageGame[], side: keyof DamageGame): DamageBestGames => {
    const pick = (type: keyof DamageBreakdown) =>
      games.reduce<DamageBreakdown>(
        (best, game) => (game[side][type] > best[type] ? game[side] : best),
        noDamage,
      );
    return { physical: pick("physical"), magical: pick("magical"), trueDamage: pick("trueDamage") };
  };
  const damageGames: (DamageGame & { championId: number })[] = damageGameRows.map((row) => ({
    championId: row.championId,
    dealt: { physical: row.dealtPhysical, magical: row.dealtMagical, trueDamage: row.dealtTrue },
    taken: { physical: row.takenPhysical, magical: row.takenMagical, trueDamage: row.takenTrue },
  }));
  const damageGamesByChampion = new Map<number, DamageGame[]>();
  for (const game of damageGames) {
    const list = damageGamesByChampion.get(game.championId);
    if (list) list.push(game);
    else damageGamesByChampion.set(game.championId, [game]);
  }

  // Same DISTINCT ON pattern again, for the single match with the most
  // total ability casts on each champion.
  const championMaxAbilityRows = await championMaxAbilityRowsQuery;

  // Same DISTINCT ON pattern, for the single match with the most anvils
  // bought in total on each champion. Anvil columns are null for matches
  // ingested before timelines were fetched (see ChampionEconomyStats), hence
  // the coalesces.
  const championMaxAnvilRows = await championMaxAnvilRowsQuery;

  const championMaxAnvilsById = new Map(
    championMaxAnvilRows.map((row) => [
      row.championId,
      { stat: row.stat, legendary: row.legendary, prismatic: row.prismatic },
    ]),
  );

  // Per-champion finish distribution. The histogram's length comes from the
  // worst placement actually seen across all of this summoner's matches,
  // never from a team-count constant (see CLAUDE.md §2).
  const championPlacementRows = await championPlacementRowsQuery;

  const worstPlacementSeen = Math.max(
    0,
    ...championPlacementRows.map((row) => row.placement),
  );
  const placementCountsByChampion = new Map<number, number[]>();
  for (const row of championPlacementRows) {
    if (row.placement < 1) continue;
    let counts = placementCountsByChampion.get(row.championId);
    if (!counts) {
      counts = new Array<number>(worstPlacementSeen).fill(0);
      placementCountsByChampion.set(row.championId, counts);
    }
    counts[row.placement - 1] += row.count;
  }

  const championMaxAbilityById = new Map(
    championMaxAbilityRows.map((row) => [
      row.championId,
      { q: row.q, w: row.w, e: row.e, r: row.r },
    ]),
  );

  // `augments` is a jsonb number[] with zero-padding already dropped (see
  // CLAUDE.md §2) — a player can hold up to 4 per match, so this counts
  // picks across every tracked match, not matches. `placement` comes along
  // too so `augmentPicks` below can build each augment's top1/top3ExclTop1/
  // remaining split — there's no per-augment placement column, so an
  // augment's breakdown is tallied from the CONTAINING row's placement,
  // same as every augment picked alongside it in that match.
  const augmentRows = await augmentRowsQuery;

  const augmentPickCounts = new Map<number, number>();
  const augmentBreakdownById = new Map<
    number,
    { top1: number; top3ExclTop1: number; remaining: number }
  >();
  /** championId -> (augmentId -> picks / top 3 finishes), for the dossier. */
  const augmentsByChampion = new Map<
    number,
    Map<number, { picks: number; top1: number; top3: number }>
  >();
  for (const row of augmentRows) {
    let championAugments = augmentsByChampion.get(row.championId);
    if (!championAugments) {
      championAugments = new Map();
      augmentsByChampion.set(row.championId, championAugments);
    }
    for (const augmentId of row.augments) {
      augmentPickCounts.set(augmentId, (augmentPickCounts.get(augmentId) ?? 0) + 1);
      const championEntry = championAugments.get(augmentId) ?? { picks: 0, top1: 0, top3: 0 };
      championEntry.picks += 1;
      if (row.placement === 1) championEntry.top1 += 1;
      if (row.placement <= 3) championEntry.top3 += 1;
      championAugments.set(augmentId, championEntry);

      const breakdown = augmentBreakdownById.get(augmentId) ?? {
        top1: 0,
        top3ExclTop1: 0,
        remaining: 0,
      };
      if (row.placement === 1) breakdown.top1 += 1;
      else if (row.placement >= 2 && row.placement <= 3) breakdown.top3ExclTop1 += 1;
      else breakdown.remaining += 1;
      augmentBreakdownById.set(augmentId, breakdown);
    }
  }

  // The full normal-pool catalog, not just picked augments — every augment
  // appears here with timesPicked 0 if the summoner has never picked it.
  // Excludes the GoH*/Crafting* augments (see augmentData.ts's
  // `isRemovedAugment`).
  const augmentCatalog = await getCatalogAugments();
  const augments: AugmentStats[] = augmentCatalog.map((augment) => ({
    augmentId: augment.id,
    augmentName: augment.name,
    iconUrl: augmentIconUrl(augment.iconLarge),
    rarity: augment.rarity,
    timesPicked: augmentPickCounts.get(augment.id) ?? 0,
  }));

  // The "Guest of Honor" screen's own data — reuses `augmentPickCounts`/
  // `augmentBreakdownById` above rather than a separate query, since those
  // maps are already built from every augment id ever seen in
  // `match_participants.augments` (GoH-prefixed ones included whenever the
  // mechanic actually fired), not just the normal catalog's ids.
  const guestOfHonorDetails = await getGuestOfHonorAugmentDetails();
  const noGuestOfHonorBreakdown = { top1: 0, top3ExclTop1: 0, remaining: 0 };
  const guestOfHonor: GuestOfHonorChampionStats[] = GUEST_OF_HONOR_CHAMPIONS.map(
    (champion) => ({
      championId: champion.championId,
      championName: champion.championName,
      rows: champion.rows.map((row) => ({
        key: row.key,
        label: row.label,
        augments: row.augmentIds.map((augmentId) => {
          const detail = guestOfHonorDetails.get(augmentId);
          const breakdown =
            augmentBreakdownById.get(augmentId) ?? noGuestOfHonorBreakdown;
          return {
            augmentId,
            augmentName: detail?.name ?? `Augment ${augmentId}`,
            iconUrl: detail?.iconUrl ?? "",
            timesPicked: augmentPickCounts.get(augmentId) ?? 0,
            top1: breakdown.top1,
            top3ExclTop1: breakdown.top3ExclTop1,
            remaining: breakdown.remaining,
          };
        }),
      })),
    }),
  );

  // The augment-crafting screen's own data — same "reuse the maps already
  // built from every augment id ever seen in match_participants.augments"
  // approach as `guestOfHonor` above, just against `META_AUGMENT_API_NAMES`'
  // 5 ids instead of the Guest of Honor set. Unlike the normal catalog
  // (`augments`/`augmentPicks`), there's no "0 if never picked" full-catalog
  // entry to build separately from a picked-only one — `getMetaAugments()`
  // is already the exact fixed 5-entry list to show, so one map suffices.
  const metaAugmentCatalog = await getMetaAugments();
  const noMetaBreakdown = { top1: 0, top3ExclTop1: 0, remaining: 0 };
  const metaAugments: MetaAugmentStats[] = metaAugmentCatalog.map((augment) => {
    const breakdown = augmentBreakdownById.get(augment.id) ?? noMetaBreakdown;
    return {
      augmentId: augment.id,
      augmentName: augment.name,
      iconUrl: augmentIconUrl(augment.iconLarge),
      timesPicked: augmentPickCounts.get(augment.id) ?? 0,
      top1: breakdown.top1,
      top3ExclTop1: breakdown.top3ExclTop1,
      remaining: breakdown.remaining,
    };
  });

  // Inverts `augmentsByChampion` (augmentId -> per-champion tallies) for the
  // augment chart's hover card: which champions an augment was picked on.
  const championsByAugment = new Map<
    number,
    { championId: number; picks: number; top3: number }[]
  >();
  for (const [championId, championAugments] of augmentsByChampion) {
    for (const [augmentId, entry] of championAugments) {
      const list = championsByAugment.get(augmentId) ?? [];
      list.push({ championId, picks: entry.picks, top3: entry.top3 });
      championsByAugment.set(augmentId, list);
    }
  }

  // Same "only augments actually picked" shape as `championPicks` above,
  // built from `augmentBreakdownById`/`augmentPickCounts` rather than a
  // second query.
  const augmentPicks: AugmentPickBreakdown[] = augmentCatalog
    .filter((augment) => augmentPickCounts.has(augment.id))
    .map((augment) => {
      const breakdown = augmentBreakdownById.get(augment.id)!;
      return {
        augmentId: augment.id,
        augmentName: augment.name,
        timesPicked: augmentPickCounts.get(augment.id)!,
        top1: breakdown.top1,
        top3ExclTop1: breakdown.top3ExclTop1,
        remaining: breakdown.remaining,
        topChampions: [...(championsByAugment.get(augment.id) ?? [])]
          .sort((a, b) => b.picks - a.picks || b.top3 - a.top3)
          .slice(0, 3)
          .map((entry) => ({
            championName:
              championNameById.get(entry.championId) ?? `Champion ${entry.championId}`,
            games: entry.picks,
            top3: entry.top3,
          })),
        championCount: championsByAugment.get(augment.id)?.length ?? 0,
      };
    })
    .sort((a, b) => b.timesPicked - a.timesPicked);

  // `items` is a jsonb number[] of end-of-match inventory slots (0 = empty
  // slot — see CLAUDE.md §2) — dedupe per match same as augments/bans, in
  // case a player ever ends up holding the same item in two slots.
  // `placement` comes along too so `prismaticItemPicks` below can build each
  // item's top1/top3ExclTop1/remaining split — same "no per-entity placement
  // column, tally from the containing row's placement" approach as
  // `augmentRows`/`augmentBreakdownById` above.
  // `championId` comes along so the per-champion item rows
  // (`ChampionStats.items`) can be tallied from this same scan instead of
  // a second query — every row already carries the champion it was played
  // on.
  // The boots columns ride along for the same reason — the boots section
  // needs a per-match scan over the exact same rows, and `items` here is
  // also what answers "did this match END with boots on" (see
  // `matchesFinishedBarefoot`), which the purchase/sale events can't.
  const itemRows = await itemRowsQuery;

  const prismaticHeldCounts = new Map<number, number>();
  const prismaticBreakdownById = new Map<
    number,
    { top1: number; top3ExclTop1: number; remaining: number }
  >();
  /** Matches on a champion an item was counted in, and how many of those
   * finished top 3 — the value type of every per-champion item map below. */
  type ChampionItemTally = { count: number; top1: number; top3: number };
  const tallyChampionItem = (
    byChampion: Map<number, Map<number, ChampionItemTally>>,
    championId: number,
    itemId: number,
    placement: number,
  ) => {
    let championTallies = byChampion.get(championId);
    if (!championTallies) {
      championTallies = new Map();
      byChampion.set(championId, championTallies);
    }
    const tally = championTallies.get(itemId) ?? { count: 0, top1: 0, top3: 0 };
    tally.count += 1;
    if (placement === 1) tally.top1 += 1;
    if (placement <= 3) tally.top3 += 1;
    championTallies.set(itemId, tally);
  };
  /** championId -> (itemId -> matches finished holding it). */
  const itemCountsByChampion = new Map<number, Map<number, ChampionItemTally>>();
  /** championId -> (Legendary itemId -> matches it was built in, bought at
   * any point or held at the end). Same source as the page-level
   * `legendaryItems`, so the dossier and the Vault agree: an item bought and
   * later sold still counts (see CLAUDE.md §2 on why end-of-match inventory
   * alone undercounts). */
  const legendaryBuiltByChampion = new Map<number, Map<number, ChampionItemTally>>();
  /** championId -> (boot itemId -> matches it was bought in at least once). */
  const bootsBoughtByChampion = new Map<number, Map<number, ChampionItemTally>>();
  const isBuildItem = await getBuildItemFilter();
  /** itemId -> how many pairs of that boot were bought / sold. */
  const bootsBoughtById = new Map<number, number>();
  const bootsSoldById = new Map<number, number>();
  const arenaBootIds = new Set<number>(ARENA_BOOT_ITEM_IDS);
  let totalBootsBought = 0;
  let totalBootsSold = 0;
  let matchesWithoutBoots = 0;
  let matchesFinishedBarefoot = 0;
  const bootsOutcomes: BootsStats["outcomes"] = {
    keptOn: { games: 0, top3Finishes: 0 },
    soldOff: { games: 0, top3Finishes: 0 },
    neverBought: { games: 0, top3Finishes: 0 },
  };
  let mostBootsBoughtInOneMatch = 0;
  const isLegendaryItem = await getLegendaryItemFilter();
  /** itemId -> matches had / top1 / top3, for the Shardblade, the special
   * items (end-of-match inventory) and Legendary items (bought or held). */
  const outcomeById = new Map<number, { timesPicked: number; top1: number; top3: number }>();
  const heldOutcomeIds = new Set<number>([SHARDBLADE_ITEM_ID, ...SPECIAL_ITEM_IDS]);
  /** championId -> (Shardblade/special itemId -> matches held at the end). */
  const specialHeldByChampion = new Map<number, Map<number, ChampionItemTally>>();
  const tallyOutcome = (itemId: number, placement: number) => {
    const entry = outcomeById.get(itemId) ?? { timesPicked: 0, top1: 0, top3: 0 };
    entry.timesPicked += 1;
    if (placement === 1) entry.top1 += 1;
    if (placement <= 3) entry.top3 += 1;
    outcomeById.set(itemId, entry);
  };
  for (const row of itemRows) {
    const matchItemIds = new Set<number>([...row.items, ...(row.purchasedItemIds ?? [])]);
    for (const itemId of matchItemIds) {
      const counts = heldOutcomeIds.has(itemId)
        ? row.items.includes(itemId)
        : isLegendaryItem(itemId);
      if (counts) tallyOutcome(itemId, row.placement);
      if (!heldOutcomeIds.has(itemId) && isLegendaryItem(itemId)) {
        tallyChampionItem(legendaryBuiltByChampion, row.championId, itemId, row.placement);
      }
    }

    // Null means the match predates timeline ingestion, so "no boots bought"
    // is unknown rather than zero — those rows are skipped entirely instead
    // of counting as barefoot games. (Currently none: every ingested match
    // has a timeline.)
    if (row.bootsBought && row.bootsSold) {
      for (const itemId of row.bootsBought) {
        bootsBoughtById.set(itemId, (bootsBoughtById.get(itemId) ?? 0) + 1);
      }
      for (const itemId of new Set(row.bootsBought)) {
        tallyChampionItem(bootsBoughtByChampion, row.championId, itemId, row.placement);
      }
      for (const itemId of row.bootsSold) {
        bootsSoldById.set(itemId, (bootsSoldById.get(itemId) ?? 0) + 1);
      }
      totalBootsBought += row.bootsBought.length;
      totalBootsSold += row.bootsSold.length;
      if (row.bootsBought.length === 0) matchesWithoutBoots += 1;
      const finishedBarefoot = !row.items.some((itemId) => arenaBootIds.has(itemId));
      if (finishedBarefoot) {
        matchesFinishedBarefoot += 1;
      }
      const outcome =
        row.bootsBought.length === 0
          ? bootsOutcomes.neverBought
          : finishedBarefoot
            ? bootsOutcomes.soldOff
            : bootsOutcomes.keptOn;
      outcome.games += 1;
      if (row.placement <= 3) outcome.top3Finishes += 1;
      mostBootsBoughtInOneMatch = Math.max(
        mostBootsBoughtInOneMatch,
        row.bootsBought.length,
      );
    }

    for (const itemId of new Set(row.items)) {
      if (itemId === 0) continue;

      if (heldOutcomeIds.has(itemId)) {
        tallyChampionItem(specialHeldByChampion, row.championId, itemId, row.placement);
      }

      if (isBuildItem(itemId)) {
        tallyChampionItem(itemCountsByChampion, row.championId, itemId, row.placement);
      }

      prismaticHeldCounts.set(itemId, (prismaticHeldCounts.get(itemId) ?? 0) + 1);

      const breakdown = prismaticBreakdownById.get(itemId) ?? {
        top1: 0,
        top3ExclTop1: 0,
        remaining: 0,
      };
      if (row.placement === 1) breakdown.top1 += 1;
      else if (row.placement >= 2 && row.placement <= 3) breakdown.top3ExclTop1 += 1;
      else breakdown.remaining += 1;
      prismaticBreakdownById.set(itemId, breakdown);
    }
  }

  const itemNamesForOutcomes = await getItemNamesById();
  const toOutcome = (itemId: number): ItemOutcomeStats => ({
    itemId,
    itemName: itemNamesForOutcomes.get(itemId) ?? `Item ${itemId}`,
    iconUrl: itemIconUrl(itemId),
    ...(outcomeById.get(itemId) ?? { timesPicked: 0, top1: 0, top3: 0 }),
  });
  const specialItems = SPECIAL_ITEM_IDS.map(toOutcome);
  const legendaryItems = [...outcomeById.keys()]
    .filter((itemId) => isLegendaryItem(itemId))
    .map(toOutcome)
    .sort((a, b) => b.timesPicked - a.timesPicked || b.top3 - a.top3);

  const itemGoldById = await getItemGoldById();

  // The full catalog, not just held items — same "every entry, 0 if never
  // seen" shape as `augments` above.
  const prismaticItemCatalog = await getPrismaticItems();
  const prismaticItems: PrismaticItemStats[] = prismaticItemCatalog.map((item) => ({
    itemId: item.id,
    itemName: item.name,
    iconUrl: itemIconUrl(item.id),
    timesHeld: prismaticHeldCounts.get(item.id) ?? 0,
  }));

  // Same "only entities actually held/picked" shape as `augmentPicks` above,
  // built from `prismaticBreakdownById`/`prismaticHeldCounts` rather than a
  // second query.
  const prismaticItemPicks: PrismaticItemPickBreakdown[] = prismaticItemCatalog
    .filter((item) => prismaticHeldCounts.has(item.id))
    .map((item) => {
      const breakdown = prismaticBreakdownById.get(item.id)!;
      return {
        itemId: item.id,
        itemName: item.name,
        timesHeld: prismaticHeldCounts.get(item.id)!,
        top1: breakdown.top1,
        top3ExclTop1: breakdown.top3ExclTop1,
        remaining: breakdown.remaining,
      };
    })
    .sort((a, b) => b.timesHeld - a.timesHeld);

  // The full 8-boot catalog, zero-filled — same "every entry, even unused"
  // shape as `prismaticItems`/`augments` above, so the pie chart's legend
  // can show the pairs never bought too rather than silently omitting them.
  const bootCatalog = await getArenaBoots();
  const boots: BootStats[] = bootCatalog
    .map((boot) => ({
      itemId: boot.id,
      itemName: boot.name,
      iconUrl: itemIconUrl(boot.id),
      timesBought: bootsBoughtById.get(boot.id) ?? 0,
      timesSold: bootsSoldById.get(boot.id) ?? 0,
    }))
    .sort((a, b) => b.timesBought - a.timesBought || a.itemId - b.itemId);
  const bootsStats: BootsStats = {
    boots,
    totalBought: totalBootsBought,
    totalSold: totalBootsSold,
    goldSpent: bootCatalog.reduce(
      (total, boot) => total + (bootsBoughtById.get(boot.id) ?? 0) * boot.goldCost,
      0,
    ),
    matchesWithoutBoots,
    matchesFinishedBarefoot,
    outcomes: bootsOutcomes,
    mostBoughtInOneMatch: mostBootsBoughtInOneMatch,
  };

  // The dossier lists every item and augment (it scrolls), so none of the
  // per-champion lists below are capped.
  const itemNamesById = await getItemNamesById();
  const prismaticItemIds = new Set(prismaticItemCatalog.map((item) => item.id));

  /** Highest count first, ties broken by item id rather than Map insertion
   * order, so the list is stable across requests instead of reflecting
   * whichever match happened to be scanned first. */
  const rankTallies = (tallies: Map<number, ChampionItemTally> | undefined) =>
    [...(tallies ?? new Map<number, ChampionItemTally>())].sort(
      (a, b) => b[1].count - a[1].count || a[0] - b[0],
    );
  const toChampionItem = ([itemId, tally]: [number, ChampionItemTally]) => ({
    itemId,
    itemName: itemNamesById.get(itemId) ?? `Item ${itemId}`,
    iconUrl: itemIconUrl(itemId),
    count: tally.count,
    top1: tally.top1,
    top3: tally.top3,
  });

  // The dossier's augment list — normal-pool augments only (the same
  // catalog as `augments`), so Guest of Honor/crafting picks don't crowd it.
  const augmentCatalogById = new Map(augmentCatalog.map((augment) => [augment.id, augment]));
  const championAugments = (championId: number): ChampionAugmentStats[] =>
    [...(augmentsByChampion.get(championId) ?? new Map())]
      .filter(([augmentId]) => augmentCatalogById.has(augmentId))
      .sort((a, b) => b[1].picks - a[1].picks || b[1].top3 - a[1].top3 || a[0] - b[0])
      .map(([augmentId, entry]) => {
        const augment = augmentCatalogById.get(augmentId)!;
        return {
          augmentId,
          augmentName: augment.name,
          iconUrl: augmentIconUrl(augment.iconLarge),
          rarity: augment.rarity,
          timesPicked: entry.picks,
          top1: entry.top1,
          top3: entry.top3,
        };
      });

  const champions: Record<number, ChampionStats> = {};
  for (const row of championRows) {
    const items = {
      legendary: rankTallies(legendaryBuiltByChampion.get(row.championId)).map(toChampionItem),
      prismatic: rankTallies(itemCountsByChampion.get(row.championId))
        .filter(([itemId]) => prismaticItemIds.has(itemId))
        .map(toChampionItem),
      special: rankTallies(specialHeldByChampion.get(row.championId)).map(toChampionItem),
      boots: rankTallies(bootsBoughtByChampion.get(row.championId)).map(toChampionItem),
    };

    champions[row.championId] = {
      championId: row.championId,
      championName: row.championName,
      matchesPlayed: row.matchesPlayed,
      timePlayedSeconds: row.totalTimePlayedSeconds,
      longestGameSeconds: row.longestGameSeconds,
      avgPlacement: row.avgPlacement,
      placementCounts:
        placementCountsByChampion.get(row.championId) ??
        new Array<number>(worstPlacementSeen).fill(0),
      items,
      form: formByChampionName.get(row.championName) ?? {
        games: [],
        currentWinStreak: 0,
        longestWinStreak: 0,
      },
      augments: championAugments(row.championId),
      combat: {
        doubleKills: row.totalDoubleKills,
        tripleKills: row.totalTripleKills,
        quadraKills: row.totalQuadraKills,
        pentaKills: row.totalPentaKills,
        largestCriticalStrike: row.largestCriticalStrike,
        damageSelfMitigated: row.totalDamageSelfMitigated,
        mostDoubleKills: row.mostDoubleKills,
        mostTripleKills: row.mostTripleKills,
        mostQuadraKills: row.mostQuadraKills,
        mostPentaKills: row.mostPentaKills,
        bestDamageSelfMitigated: row.bestDamageSelfMitigated,
      },
      economy: {
        goldEarned: row.totalGoldEarned,
        bestGameGoldEarned: row.bestGoldEarned,
        itemsPurchased: row.totalItemsPurchased,
        statAnvilsBought: row.totalStatAnvils,
        legendaryAnvilsBought: row.totalLegendaryAnvils,
        prismaticAnvilsBought: row.totalPrismaticAnvils,
        mostItemsPurchased: row.mostItemsPurchased,
        maxGameAnvils: championMaxAnvilsById.get(row.championId) ?? {
          stat: 0,
          legendary: 0,
          prismatic: 0,
        },
      },
      kda: {
        totalKills: row.totalKills,
        totalDeaths: row.totalDeaths,
        totalAssists: row.totalAssists,
        bestGame: championBestGameById.get(row.championId) ?? noBestGame,
        soloKills: row.totalSoloKills,
        largestKillingSpree: row.largestKillingSpree,
        mostKills: row.mostKills,
        mostDeaths: row.mostDeaths,
        fewestDeaths: row.fewestDeaths,
        mostAssists: row.mostAssists,
        mostSoloKills: row.mostSoloKills,
      },
      damage: {
        total: {
          physical: row.totalDamagePhysical,
          magical: row.totalDamageMagical,
          trueDamage: row.totalDamageTrue,
        },
        maxGame: championMaxDamageById.get(row.championId) ?? noDamage,
        bestGameByType: bestGamesByType(damageGamesByChampion.get(row.championId) ?? [], "dealt"),
      },
      damageTaken: {
        total: {
          physical: row.totalDamageTakenPhysical,
          magical: row.totalDamageTakenMagical,
          trueDamage: row.totalDamageTakenTrue,
        },
        maxGame: championMaxDamageTakenById.get(row.championId) ?? noDamage,
        bestGameByType: bestGamesByType(damageGamesByChampion.get(row.championId) ?? [], "taken"),
      },
      ability: {
        total: {
          q: row.totalQCasts,
          w: row.totalWCasts,
          e: row.totalECasts,
          r: row.totalRCasts,
        },
        maxGame: championMaxAbilityById.get(row.championId) ?? noAbility,
      },
      utility: {
        total: {
          healingAndShielding: row.totalHealingAndShielding,
          ccScoreSeconds: row.totalCcScoreSeconds,
          ccTimeDealt: row.totalCcTimeDealt,
          savesFromDeath: row.totalSavesFromDeath,
        },
        bestByType: {
          healingAndShielding: row.bestHealingAndShielding,
          ccScoreSeconds: row.bestCcScoreSeconds,
          ccTimeDealt: row.bestCcTimeDealt,
          savesFromDeath: row.bestSavesFromDeath,
        },
      },
    };
  }

  // The full champion catalog, not just ones the summoner has played — same
  // "every entry, 0 if never seen" shape as augments/prismatic items above.
  // Reuses `championRows` (already fetched for `champions` above) rather
  // than a second query, keyed by championId for the lookup.
  const matchesPlayedByChampion = new Map(
    championRows.map((row) => [row.championId, row.matchesPlayed]),
  );
  const championNamesById = await getChampionNamesById();
  const championCatalog: ChampionCatalogEntry[] = [...championNamesById.entries()]
    .map(([championId, championName]) => ({
      championId,
      championName,
      timesPlayed: matchesPlayedByChampion.get(championId) ?? 0,
    }))
    .sort((a, b) => a.championName.localeCompare(b.championName));

  const summonerSpells = buildSummonerSpellStats(
    await summonerSpellRowsQuery,
    await getSummonerSpells(),
  );
  const damageCurves = buildDamageCurveStats(await damageCurveRowsQuery);

  return {
    profile: {
      puuid: summoner.puuid,
      riotIdGameName: summoner.riotIdGameName,
      riotIdTagline: summoner.riotIdTagline,
      region: summoner.region,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      matchesPlayed: agg.matchesPlayed,
    },
    kda: {
      kills: agg.kills,
      deaths: agg.deaths,
      assists: agg.assists,
      kda,
      mostKills: agg.mostKills,
      mostDeaths: agg.mostDeaths,
      mostAssists: agg.mostAssists,
      bestKda: agg.bestKda,
    },
    timePlayed: {
      timePlayedSeconds: agg.timePlayedSeconds,
      averageGameSeconds:
        agg.matchesPlayed > 0 ? agg.timePlayedSeconds / agg.matchesPlayed : 0,
      longestGameSeconds: agg.longestGameSeconds,
      longestStreakDays,
      currentStreakDays,
      mostGamesInADay,
      favoriteDayOfWeek,
    },
    calendar: {
      days: calendarDays,
      gamesByHour,
      top1ByHour,
      top3ByHour,
      avgPlacementByHour,
      kdaByHour,
      avgGameSecondsByHour,
      championsByHour,
    },
    placements: {
      avgPlacement: agg.avgPlacement,
      top3Finishes: agg.top3Finishes,
      top1Finishes: byPlacement[1] ?? 0,
      byPlacement,
      detailsByPlacement,
      longestWinStreak,
      longestTop1Streak,
      recentPlacements,
    },
    teamSlot: {
      byTeamId,
    },
    teamSynergy: {
      champions: teamSynergyChampions,
      matrix: teamSynergyMatrix,
      matrixTop1: teamSynergyMatrixTop1,
      matrixTop3: teamSynergyMatrixTop3,
      totalDistinctChampions: gamesOnTeamByChampion.size,
      totalDistinctPairings: pairAggByKey.size,
      mostPlayedPairing,
      bestPairing,
      teammateChampions: [...teammateChampionAgg.values()]
        .filter((champion) => champion.games >= TEAMMATE_CHAMPIONS_MIN_GAMES)
        .sort((a, b) => b.games - a.games),
    },
    teammates: {
      teammates,
      totalTeammates: teammateAggRows.length,
    },
    nemesis: {
      opponents,
      totalOpponents: opponentAggRows.length,
    },
    versus: {
      champions: versusChampions,
      duelsWon: duelTotals?.duelsWon ?? 0,
      duelsLost: duelTotals?.duelsLost ?? 0,
    },
    bannedChampions: {
      champions: bannedChampions,
      matchesTracked: matchBans.length,
      totalBans,
      noBanCount,
      duplicateBanCount,
    },
    damage: {
      total: {
        physical: agg.totalDamagePhysical,
        magical: agg.totalDamageMagical,
        trueDamage: agg.totalDamageTrue,
      },
      maxGame: globalMaxDamageGame ?? noDamage,
      bestGameByType: bestGamesByType(damageGames, "dealt"),
    },
    damageTaken: {
      total: {
        physical: agg.totalDamageTakenPhysical,
        magical: agg.totalDamageTakenMagical,
        trueDamage: agg.totalDamageTakenTrue,
      },
      maxGame: globalMaxDamageTakenGame ?? noDamage,
      bestGameByType: bestGamesByType(damageGames, "taken"),
    },
    kills: {
      doubleKills: killsAgg.doubleKills,
      tripleKills: killsAgg.tripleKills,
      quadraKills: killsAgg.quadraKills,
      pentaKills: killsAgg.pentaKills,
      largestKillingSpree: killsAgg.largestKillingSpree,
      firstBloodKills: killsAgg.firstBloodKills,
      firstBloodAssists: killsAgg.firstBloodAssists,
      soloKills: killsAgg.soloKills,
      flawlessAces: killsAgg.flawlessAces,
    },
    economy: {
      totalGoldEarned: economyAgg.totalGoldEarned,
      mostGoldInOneGame: economyAgg.mostGoldInOneGame,
      itemsPurchased: economyAgg.itemsPurchased,
      consumablesPurchased: economyAgg.consumablesPurchased,
      anvils: {
        stat: economyAgg.statAnvils,
        legendary: economyAgg.legendaryAnvils,
        prismatic: economyAgg.prismaticAnvils,
      },
      mostStatAnvilsInOneMatch: economyAgg.mostStatAnvilsInOneMatch,
      anvilGoldSpent: {
        stat: economyAgg.statAnvils * (itemGoldById.get(220000) ?? 0),
        legendary: economyAgg.legendaryAnvils * (itemGoldById.get(220001) ?? 0),
        prismatic: economyAgg.prismaticAnvils * (itemGoldById.get(220007) ?? 0),
      },
      shardblade: toOutcome(SHARDBLADE_ITEM_ID),
    },
    utility: {
      total: {
        healingAndShielding: utilityAgg.totalHealingAndShielding,
        ccScoreSeconds: utilityAgg.totalCcScoreSeconds,
        ccTimeDealt: utilityAgg.totalCcTimeDealt,
        savesFromDeath: utilityAgg.totalSavesFromDeath,
      },
      bestByType: {
        healingAndShielding: utilityAgg.bestHealingAndShielding,
        ccScoreSeconds: utilityAgg.bestCcScoreSeconds,
        ccTimeDealt: utilityAgg.bestCcTimeDealt,
        savesFromDeath: utilityAgg.bestSavesFromDeath,
      },
    },
    ability: {
      total: {
        q: abilityAgg.totalQCasts,
        w: abilityAgg.totalWCasts,
        e: abilityAgg.totalECasts,
        r: abilityAgg.totalRCasts,
      },
      maxGame: globalMaxAbilityGame ?? noAbility,
      totalSkillshotsHit: abilityAgg.totalSkillshotsHit,
      bestSkillshotsHit: abilityAgg.bestSkillshotsHit,
    },
    summonerSpells,
    damageCurves,
    fun: {
      totalFistBumps: funAgg.totalFistBumps,
      totalPings,
      totalSkillshotsDodged: funAgg.totalSkillshotsDodged,
      bestSkillshotsDodged: funAgg.bestSkillshotsDodged,
    },
    pings: {
      pings: pingTotals,
    },
    augments: {
      augments,
    },
    augmentPicks: {
      augments: augmentPicks,
    },
    guestOfHonor: {
      champions: guestOfHonor,
    },
    metaAugments: {
      augments: metaAugments,
    },
    specialItems,
    legendaryItems,
    prismaticItems: {
      items: prismaticItems,
    },
    prismaticItemPicks: {
      items: prismaticItemPicks,
    },
    boots: bootsStats,
    championCatalog: {
      champions: championCatalog,
    },
    championPicks: {
      champions: championPicks,
    },
    champions,
    championDisplayNames: await getChampionDisplayNames(),
    lastMatchAt,
  };
}

/**
 * Per-summoner memo of the built stats response. Building it runs ~45
 * queries (measured ~9.6s against the dev database), and the result only
 * changes when ingestion writes a new match for this summoner, so the cache
 * key is that summoner's match count plus most recent game time — a cheap
 * query that turns every repeat page view into a lookup.
 */
const statsCache = new Map<string, { key: string; response: Promise<SummonerStatsResponse> }>();
// Kept to the most recently viewed summoners: every recap otherwise stays in
// memory for the process's lifetime. The Map's insertion order is the
// recency order (a hit moves its entry to the end).
const STATS_CACHE_MAX = 50;

async function getSummonerStats(summoner: Summoner): Promise<SummonerStatsResponse> {
  const [freshness] = await db
    .select({
      matchCount: sql<number>`count(*)::int`,
      lastGame: sql<string | null>`max(${matches.gameCreation})::text`,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(eq(matchParticipants.puuid, summoner.puuid));
  const key = `${freshness.matchCount}:${freshness.lastGame ?? ""}`;

  const cached = statsCache.get(summoner.puuid);
  if (cached && cached.key === key) {
    statsCache.delete(summoner.puuid);
    statsCache.set(summoner.puuid, cached);
    return cached.response;
  }

  const response = buildSummonerStats(summoner);
  statsCache.delete(summoner.puuid);
  statsCache.set(summoner.puuid, { key, response });
  if (statsCache.size > STATS_CACHE_MAX) {
    statsCache.delete(statsCache.keys().next().value!);
  }
  // A failed build must not stay cached as a rejected promise.
  response.catch(() => {
    if (statsCache.get(summoner.puuid)?.response === response) {
      statsCache.delete(summoner.puuid);
    }
  });
  return response;
}

// `ilike` gives case-insensitive matching, but `%` and `_` in a hand-typed
// URL would otherwise act as wildcards and could resolve to a different
// summoner (Riot IDs may legitimately contain `_`).
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Case-insensitive, since Riot IDs get typed and shared by hand. */
async function findSummonerByRiotId(region: string, gameName: string, tagLine: string) {
  const [summoner] = await db
    .select()
    .from(summoners)
    .where(
      and(
        ilike(summoners.region, escapeLike(region)),
        ilike(summoners.riotIdGameName, escapeLike(gameName)),
        ilike(summoners.riotIdTagline, escapeLike(tagLine)),
      ),
    );
  return summoner as Summoner | undefined;
}

export async function summonerRoutes(app: FastifyInstance) {
  // The web app's search: resolves a Riot ID, starts tracking it if it's new
  // (anyone can be looked up, see CLAUDE.md §1), and queues a refresh when
  // its data is stale — or, with `fetch`, when it was never fetched (see
  // lookupSchema). Answers with the canonical Riot ID (Riot's
  // casing) so the web app can build the summoner page URL from it.
  app.post("/summoners/lookup", async (request, reply) => {
    const parsed = lookupSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_riot_id" };
    }
    const { region, gameName, tagLine, fetch } = parsed.data;
    const ip = clientIp(request);

    const allowed = lookupLimiter.hit(ip);
    if (!allowed.ok) {
      reply.code(429).header("retry-after", allowed.retryAfterSeconds);
      return { error: "rate_limited", retryAfterSeconds: allowed.retryAfterSeconds };
    }

    let summoner = await findSummonerByRiotId(region, gameName, tagLine);
    if (!summoner) {
      try {
        const account = await riot.getAccountByRiotId(gameName, tagLine, region);
        const profile = await riot.getSummonerByPuuid(account.puuid, region);
        [summoner] = await db
          .insert(summoners)
          .values({
            puuid: account.puuid,
            riotIdGameName: account.gameName ?? gameName,
            riotIdTagline: account.tagLine ?? tagLine,
            region,
            profileIconId: profile.profileIconId,
            summonerLevel: profile.summonerLevel,
          })
          .onConflictDoUpdate({
            target: summoners.puuid,
            set: {
              riotIdGameName: account.gameName ?? gameName,
              riotIdTagline: account.tagLine ?? tagLine,
              profileIconId: profile.profileIconId,
              summonerLevel: profile.summonerLevel,
            },
          })
          .returning();
      } catch (err) {
        // account-v1 404: no such Riot ID. summoner-v4 404: the Riot ID
        // exists but has never played League on this platform.
        if (err instanceof RiotApiError && err.status === 404) {
          reply.code(404);
          return { error: "not_found" };
        }
        throw err;
      }
    }

    const lastRefreshed = summoner.lastRefreshedAt?.getTime();
    const firstFetch =
      lastRefreshed === undefined && fetch === true && !refreshQueue.isActive(summoner.puuid);
    if (firstFetch) {
      if (refreshQueue.waitingCount() >= MAX_WAITING_JOBS) {
        reply.code(503);
        return { error: "busy" };
      }
      const fetchAllowed = firstFetchLimiter.hit(ip);
      if (!fetchAllowed.ok) {
        reply.code(429).header("retry-after", fetchAllowed.retryAfterSeconds);
        return { error: "rate_limited", retryAfterSeconds: fetchAllowed.retryAfterSeconds };
      }
      refreshQueue.enqueue(summoner, "user");
    } else if (lastRefreshed !== undefined && Date.now() - lastRefreshed > REFRESH_STALE_MS) {
      refreshQueue.enqueue(summoner, "user");
    }

    return {
      region: summoner.region,
      gameName: summoner.riotIdGameName,
      tagLine: summoner.riotIdTagline,
      refreshing: refreshQueue.isActive(summoner.puuid),
    };
  });

  // Where a summoner's refresh stands, for the summoner page (queue screen,
  // "never fetched" screen, the recap's "updated" line). Never calls Riot:
  // an unknown Riot ID is a 404 here, and it's looked up through
  // POST /summoners/lookup once someone presses "fetch matches".
  app.get<{ Params: { region: string; gameName: string; tagLine: string } }>(
    "/summoners/by-riot-id/:region/:gameName/:tagLine/status",
    async (request, reply) => {
      const { region, gameName, tagLine } = request.params;
      const summoner = await findSummonerByRiotId(region, gameName, tagLine);
      if (!summoner) {
        reply.code(404);
        return { error: "Summoner not tracked" };
      }
      const [{ matchCount }] = await db
        .select({ matchCount: sql<number>`count(*)::int` })
        .from(matchParticipants)
        .where(eq(matchParticipants.puuid, summoner.puuid));
      return {
        region: summoner.region,
        gameName: summoner.riotIdGameName,
        tagLine: summoner.riotIdTagline,
        profileIconId: summoner.profileIconId,
        summonerLevel: summoner.summonerLevel,
        lastRefreshedAt: summoner.lastRefreshedAt?.toISOString() ?? null,
        matchCount,
        job: refreshQueue.view(summoner.puuid),
      };
    },
  );

  // Aggregate Arena stats for one tracked summoner's profile page.
  app.get<{ Params: { puuid: string } }>("/summoners/:puuid/stats", async (request, reply) => {
    const [summoner] = await db
      .select()
      .from(summoners)
      .where(eq(summoners.puuid, request.params.puuid));
    if (!summoner) {
      reply.code(404);
      return { error: "Summoner not tracked" };
    }
    return getSummonerStats(summoner);
  });

  // Same as above, keyed by Riot ID instead of puuid — this is what the
  // web app's /summoner/[platform]/[riotId] page actually uses, since a
  // profile URL built from puuid isn't something a person would type or
  // recognize. Case-insensitive since URLs get typed/shared by hand.
  app.get<{ Params: { region: string; gameName: string; tagLine: string } }>(
    "/summoners/by-riot-id/:region/:gameName/:tagLine/stats",
    async (request, reply) => {
      const { region, gameName, tagLine } = request.params;
      const summoner = await findSummonerByRiotId(region, gameName, tagLine);
      if (!summoner) {
        reply.code(404);
        return { error: "Summoner not tracked" };
      }
      return getSummonerStats(summoner);
    },
  );
}
