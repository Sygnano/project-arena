import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  sql,
  summoners,
  matches,
  matchParticipants,
  type Summoner,
} from "@arena/db";
import type {
  AbilityCastBreakdown,
  AugmentStats,
  BannedChampionStats,
  CalendarDayStats,
  ChampionCatalogEntry,
  ChampionPickBreakdown,
  ChampionStats,
  DamageBreakdown,
  PingBreakdown,
  PrismaticItemStats,
  SummonerStatsResponse,
  TeamSlotBreakdown,
} from "@arena/types";
import { db } from "../db.js";
import { getChampionNamesById } from "../championData.js";
import { getAugments, augmentIconUrl } from "../augmentData.js";
import { getPrismaticItems, itemIconUrl } from "../itemData.js";
import { riot } from "../riot/index.js";
import { ingestSummoner } from "../ingestion/ingestSummoner.js";

const addSummonerSchema = z.object({
  gameName: z.string().min(1),
  tagLine: z.string().min(1),
  region: z.string().min(1),
});

async function buildSummonerStats(summoner: Summoner): Promise<SummonerStatsResponse> {
  const [agg] = await db
    .select({
      matchesPlayed: sql<number>`count(*)::int`,
      top3Finishes: sql<number>`count(*) filter (where ${matchParticipants.placement} <= 3)::int`,
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
      // Independently maxed per damage type (unlike globalMaxDamageGame
      // below, which ties all three to one match) — see
      // `DamageStats.bestByType`'s doc comment.
      bestDamagePhysical: sql<number>`coalesce(max(${matchParticipants.damageDealtToChampionsPhysical}), 0)::int`,
      bestDamageMagical: sql<number>`coalesce(max(${matchParticipants.damageDealtToChampionsMagic}), 0)::int`,
      bestDamageTrue: sql<number>`coalesce(max(${matchParticipants.damageDealtToChampionsTrue}), 0)::int`,
      bestDamageTakenPhysical: sql<number>`coalesce(max(${matchParticipants.damageTakenPhysical}), 0)::int`,
      bestDamageTakenMagical: sql<number>`coalesce(max(${matchParticipants.damageTakenMagic}), 0)::int`,
      bestDamageTakenTrue: sql<number>`coalesce(max(${matchParticipants.damageTakenTrue}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid));

  const kda = agg.deaths === 0 ? agg.kills + agg.assists : (agg.kills + agg.assists) / agg.deaths;

  // The single tracked match with the highest total damage to champions —
  // ORDER BY + LIMIT 1 rather than independently MAX()-ing each damage
  // type column, since those maxes could come from different matches;
  // physical/magical/trueDamage below must all come from the same row.
  const [globalMaxDamageGame] = await db
    .select({
      physical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsPhysical}, 0)::int`,
      magical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsMagic}, 0)::int`,
      trueDamage: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsTrue}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(desc(matchParticipants.damageDealtToChampions))
    .limit(1);
  const noDamage: DamageBreakdown = { physical: 0, magical: 0, trueDamage: 0 };

  // Same as globalMaxDamageGame but for damage *taken* — there's no combined
  // "total damage taken" column to ORDER BY (unlike damageDealtToChampions),
  // so the three nullable sub-columns are coalesced and summed directly in
  // the ORDER BY expression.
  const [globalMaxDamageTakenGame] = await db
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
    .limit(1);

  const [killsAgg] = await db
    .select({
      doubleKills: sql<number>`coalesce(sum(${matchParticipants.doubleKills}), 0)::int`,
      tripleKills: sql<number>`coalesce(sum(${matchParticipants.tripleKills}), 0)::int`,
      quadraKills: sql<number>`coalesce(sum(${matchParticipants.quadraKills}), 0)::int`,
      pentaKills: sql<number>`coalesce(sum(${matchParticipants.pentaKills}), 0)::int`,
      killingSprees: sql<number>`coalesce(sum(${matchParticipants.killingSprees}), 0)::int`,
      largestKillingSpree: sql<number>`coalesce(max(${matchParticipants.largestKillingSpree}), 0)::int`,
      largestMultiKill: sql<number>`coalesce(max(${matchParticipants.largestMultiKill}), 0)::int`,
      firstBloodKills: sql<number>`count(*) filter (where ${matchParticipants.firstBloodKill} = true)::int`,
      firstBloodAssists: sql<number>`count(*) filter (where ${matchParticipants.firstBloodAssist} = true)::int`,
      soloKills: sql<number>`coalesce(sum(${matchParticipants.soloKills}), 0)::int`,
      flawlessAces: sql<number>`coalesce(sum(${matchParticipants.flawlessAces}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid));

  const [economyAgg] = await db
    .select({
      totalGoldEarned: sql<number>`coalesce(sum(${matchParticipants.goldEarned}), 0)::int`,
      mostGoldInOneGame: sql<number>`coalesce(max(${matchParticipants.goldEarned}), 0)::int`,
      itemsPurchased: sql<number>`coalesce(sum(${matchParticipants.itemsPurchased}), 0)::int`,
      consumablesPurchased: sql<number>`coalesce(sum(${matchParticipants.consumablesPurchased}), 0)::int`,
      statAnvils: sql<number>`coalesce(sum(${matchParticipants.statAnvilsBought}), 0)::int`,
      legendaryAnvils: sql<number>`coalesce(sum(${matchParticipants.legendaryAnvilsBought}), 0)::int`,
      prismaticAnvils: sql<number>`coalesce(sum(${matchParticipants.prismaticAnvilsBought}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid));

  const [utilityAgg] = await db
    .select({
      totalHealingAndShielding: sql<number>`coalesce(sum(${matchParticipants.healingAndShielding}), 0)::int`,
      totalCcScoreSeconds: sql<number>`coalesce(sum(${matchParticipants.ccScoreSeconds}), 0)::int`,
      totalCcTimeDealt: sql<number>`coalesce(sum(${matchParticipants.ccTotalTimeDealt}), 0)::int`,
      totalSavesFromDeath: sql<number>`coalesce(sum(${matchParticipants.saveAllyFromDeath}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid));

  const [abilityAgg] = await db
    .select({
      totalQCasts: sql<number>`coalesce(sum(${matchParticipants.qCasts}), 0)::int`,
      totalWCasts: sql<number>`coalesce(sum(${matchParticipants.wCasts}), 0)::int`,
      totalECasts: sql<number>`coalesce(sum(${matchParticipants.eCasts}), 0)::int`,
      totalRCasts: sql<number>`coalesce(sum(${matchParticipants.rCasts}), 0)::int`,
      totalSkillshotsHit: sql<number>`coalesce(sum(${matchParticipants.skillshotsHit}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid));

  // Same "no combined total column" situation as damage taken — order by
  // the coalesced sum of all four cast columns directly.
  const [globalMaxAbilityGame] = await db
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
    .limit(1);
  const noAbility: AbilityCastBreakdown = { q: 0, w: 0, e: 0, r: 0 };

  const [funAgg] = await db
    .select({
      totalFistBumps: sql<number>`coalesce(sum(${matchParticipants.fistBumps}), 0)::int`,
      totalSkillshotsDodged: sql<number>`coalesce(sum(${matchParticipants.skillshotsDodged}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid));

  // `pings` is one jsonb object per row (14 named counters — see CLAUDE.md
  // §2), not a column per type, so summing per-type needs a JS reduce
  // rather than a single SQL sum(). Also builds `totalPings` (every type
  // combined) in the same pass rather than a second query.
  const pingsRows = await db
    .select({ pings: matchParticipants.pings })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid));

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
  const placementRows = await db
    .select({
      placement: matchParticipants.placement,
      count: sql<number>`count(*)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.placement);

  const byPlacement: Record<number, number> = {};
  for (const row of placementRows) {
    byPlacement[row.placement] = row.count;
  }

  // Longest run of consecutive tracked matches (chronological, not calendar
  // days) finishing top3 ("win", same definition as `top3Finishes`) or top1 —
  // same running-streak approach as the calendar-day streak below, just
  // walked over match order instead of distinct days.
  const placementByMatchRows = await db
    .select({
      placement: matchParticipants.placement,
      gameCreation: matches.gameCreation,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(asc(matches.gameCreation));

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

  // Grouped by UTC calendar day (see CalendarDayStats's doc comment on why
  // UTC — a deliberate simplification, not the player's own timezone) for
  // the summoner page's activity calendar.
  const calendarRows = await db
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
    .groupBy(sql`(${matches.gameCreation} at time zone 'UTC')::date`);

  const calendarDays: CalendarDayStats[] = calendarRows.map((row) => ({
    date: row.date,
    gamesPlayed: row.gamesPlayed,
    top3Rate: (row.top3Finishes / row.gamesPlayed) * 100,
    avgPlacement: row.avgPlacement,
    bestPlacement: row.bestPlacement,
    timePlayedSeconds: row.timePlayedSeconds,
  }));

  // Tracked matches grouped by UTC hour-of-day, for the "by hour" activity
  // view — not derived from `calendarDays` (grouped by date, not time of
  // day), so its own query.
  const hourRows = await db
    .select({
      hour: sql<number>`extract(hour from (${matches.gameCreation} at time zone 'UTC'))::int`,
      gamesPlayed: sql<number>`count(*)::int`,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(sql`extract(hour from (${matches.gameCreation} at time zone 'UTC'))`);

  const gamesByHour = new Array<number>(24).fill(0);
  for (const row of hourRows) {
    gamesByHour[row.hour] = row.gamesPlayed;
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
  const teamRows = await db
    .select({
      teamId: matchParticipants.teamId,
      top1: sql<number>`count(*) filter (where ${matchParticipants.placement} = 1)::int`,
      top3ExclTop1: sql<number>`count(*) filter (where ${matchParticipants.placement} between 2 and 3)::int`,
      remaining: sql<number>`count(*) filter (where ${matchParticipants.placement} > 3)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.teamId);

  const byTeamId: TeamSlotBreakdown[] = teamRows
    .map((row) => ({
      teamId: row.teamId,
      top1: row.top1,
      top3ExclTop1: row.top3ExclTop1,
      remaining: row.remaining,
    }))
    .sort((a, b) => a.teamId - b.teamId);

  // Bans are lobby-wide, stored once per match on `matches.bannedChampionIds`
  // (see CLAUDE.md §2) — join to this summoner's matches to see which bans
  // they were exposed to. One row per tracked match, since match_participants
  // has exactly one row per (matchId, puuid).
  const banRows = await db
    .select({
      matchId: matchParticipants.matchId,
      bannedChampionIds: matches.bannedChampionIds,
      placement: matchParticipants.placement,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(eq(matchParticipants.puuid, summoner.puuid));

  // Which champions were actually picked (by anyone, not just the tracked
  // summoner) in each of these matches — a champion merely being open isn't
  // enough to sample "win rate when open" from a match, since a champion
  // nobody picked can't have influenced that game's outcome at all.
  const pickRows = banRows.length
    ? await db
        .selectDistinct({
          matchId: matchParticipants.matchId,
          championId: matchParticipants.championId,
        })
        .from(matchParticipants)
        .where(
          inArray(
            matchParticipants.matchId,
            banRows.map((row) => row.matchId),
          ),
        )
    : [];
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
  const championNameRows = bannedChampionIds.length
    ? await db
        .selectDistinct({
          championId: matchParticipants.championId,
          championName: matchParticipants.championName,
        })
        .from(matchParticipants)
        .where(inArray(matchParticipants.championId, bannedChampionIds))
    : [];
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
      };
    })
    .sort((a, b) => b.banRate - a.banRate);

  const championRows = await db
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
      // Independently maxed per damage type, per champion — see
      // `ChampionDamageStats.bestByType`'s doc comment.
      bestDamagePhysical: sql<number>`coalesce(max(${matchParticipants.damageDealtToChampionsPhysical}), 0)::int`,
      bestDamageMagical: sql<number>`coalesce(max(${matchParticipants.damageDealtToChampionsMagic}), 0)::int`,
      bestDamageTrue: sql<number>`coalesce(max(${matchParticipants.damageDealtToChampionsTrue}), 0)::int`,
      bestDamageTakenPhysical: sql<number>`coalesce(max(${matchParticipants.damageTakenPhysical}), 0)::int`,
      bestDamageTakenMagical: sql<number>`coalesce(max(${matchParticipants.damageTakenMagic}), 0)::int`,
      bestDamageTakenTrue: sql<number>`coalesce(max(${matchParticipants.damageTakenTrue}), 0)::int`,
      totalQCasts: sql<number>`coalesce(sum(${matchParticipants.qCasts}), 0)::int`,
      totalWCasts: sql<number>`coalesce(sum(${matchParticipants.wCasts}), 0)::int`,
      totalECasts: sql<number>`coalesce(sum(${matchParticipants.eCasts}), 0)::int`,
      totalRCasts: sql<number>`coalesce(sum(${matchParticipants.rCasts}), 0)::int`,
      totalSoloKills: sql<number>`coalesce(sum(${matchParticipants.soloKills}), 0)::int`,
      largestKillingSpree: sql<number>`coalesce(max(${matchParticipants.largestKillingSpree}), 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.championId, matchParticipants.championName);

  // Same top1/top3ExclTop1/remaining split as `teamRows` above, grouped by
  // champion instead of lobby slot — how well each champion this summoner
  // has actually played tends to finish.
  const championPickRows = await db
    .select({
      championId: matchParticipants.championId,
      championName: matchParticipants.championName,
      top1: sql<number>`count(*) filter (where ${matchParticipants.placement} = 1)::int`,
      top3ExclTop1: sql<number>`count(*) filter (where ${matchParticipants.placement} between 2 and 3)::int`,
      remaining: sql<number>`count(*) filter (where ${matchParticipants.placement} > 3)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .groupBy(matchParticipants.championId, matchParticipants.championName);

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
  const championBestGameRows = await db
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
    );

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
  const championMaxDamageRows = await db
    .selectDistinctOn([matchParticipants.championId], {
      championId: matchParticipants.championId,
      physical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsPhysical}, 0)::int`,
      magical: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsMagic}, 0)::int`,
      trueDamage: sql<number>`coalesce(${matchParticipants.damageDealtToChampionsTrue}, 0)::int`,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid))
    .orderBy(matchParticipants.championId, desc(matchParticipants.damageDealtToChampions));

  const championMaxDamageById = new Map(
    championMaxDamageRows.map((row) => [
      row.championId,
      { physical: row.physical, magical: row.magical, trueDamage: row.trueDamage },
    ]),
  );

  // Same DISTINCT ON pattern as championMaxDamageRows, but for damage taken —
  // ordered by the same coalesced-sum expression as globalMaxDamageTakenGame
  // since there's no combined "total damage taken" column to order by.
  const championMaxDamageTakenRows = await db
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
    );

  const championMaxDamageTakenById = new Map(
    championMaxDamageTakenRows.map((row) => [
      row.championId,
      { physical: row.physical, magical: row.magical, trueDamage: row.trueDamage },
    ]),
  );

  // Same DISTINCT ON pattern again, for the single match with the most
  // total ability casts on each champion.
  const championMaxAbilityRows = await db
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
    );

  const championMaxAbilityById = new Map(
    championMaxAbilityRows.map((row) => [
      row.championId,
      { q: row.q, w: row.w, e: row.e, r: row.r },
    ]),
  );

  // `augments` is a jsonb number[] with zero-padding already dropped (see
  // CLAUDE.md §2) — a player can hold up to 4 per match, so this counts
  // picks across every tracked match, not matches.
  const augmentRows = await db
    .select({ augments: matchParticipants.augments })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid));

  const augmentPickCounts = new Map<number, number>();
  for (const row of augmentRows) {
    for (const augmentId of row.augments) {
      augmentPickCounts.set(augmentId, (augmentPickCounts.get(augmentId) ?? 0) + 1);
    }
  }

  // The full catalog, not just picked augments — every augment appears here
  // with timesPicked 0 if the summoner has never picked it.
  const augmentCatalog = await getAugments();
  const augments: AugmentStats[] = augmentCatalog.map((augment) => ({
    augmentId: augment.id,
    augmentName: augment.name,
    iconUrl: augmentIconUrl(augment.iconLarge),
    rarity: augment.rarity,
    timesPicked: augmentPickCounts.get(augment.id) ?? 0,
  }));

  // `items` is a jsonb number[] of end-of-match inventory slots (0 = empty
  // slot — see CLAUDE.md §2) — dedupe per match same as augments/bans, in
  // case a player ever ends up holding the same item in two slots.
  const itemRows = await db
    .select({ items: matchParticipants.items })
    .from(matchParticipants)
    .where(eq(matchParticipants.puuid, summoner.puuid));

  const prismaticHeldCounts = new Map<number, number>();
  for (const row of itemRows) {
    for (const itemId of new Set(row.items)) {
      if (itemId === 0) continue;
      prismaticHeldCounts.set(itemId, (prismaticHeldCounts.get(itemId) ?? 0) + 1);
    }
  }

  // The full catalog, not just held items — same "every entry, 0 if never
  // seen" shape as `augments` above.
  const prismaticItemCatalog = await getPrismaticItems();
  const prismaticItems: PrismaticItemStats[] = prismaticItemCatalog.map((item) => ({
    itemId: item.id,
    itemName: item.name,
    iconUrl: itemIconUrl(item.id),
    timesHeld: prismaticHeldCounts.get(item.id) ?? 0,
  }));

  const champions: Record<number, ChampionStats> = {};
  for (const row of championRows) {
    champions[row.championId] = {
      championId: row.championId,
      championName: row.championName,
      matchesPlayed: row.matchesPlayed,
      kda: {
        totalKills: row.totalKills,
        totalDeaths: row.totalDeaths,
        totalAssists: row.totalAssists,
        bestGame: championBestGameById.get(row.championId) ?? noBestGame,
        soloKills: row.totalSoloKills,
        largestKillingSpree: row.largestKillingSpree,
      },
      damage: {
        total: {
          physical: row.totalDamagePhysical,
          magical: row.totalDamageMagical,
          trueDamage: row.totalDamageTrue,
        },
        maxGame: championMaxDamageById.get(row.championId) ?? noDamage,
        bestByType: {
          physical: row.bestDamagePhysical,
          magical: row.bestDamageMagical,
          trueDamage: row.bestDamageTrue,
        },
      },
      damageTaken: {
        total: {
          physical: row.totalDamageTakenPhysical,
          magical: row.totalDamageTakenMagical,
          trueDamage: row.totalDamageTakenTrue,
        },
        maxGame: championMaxDamageTakenById.get(row.championId) ?? noDamage,
        bestByType: {
          physical: row.bestDamageTakenPhysical,
          magical: row.bestDamageTakenMagical,
          trueDamage: row.bestDamageTakenTrue,
        },
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
    },
    placements: {
      top3Finishes: agg.top3Finishes,
      top1Finishes: byPlacement[1] ?? 0,
      byPlacement,
      longestWinStreak,
      longestTop1Streak,
    },
    teamSlot: {
      byTeamId,
    },
    bannedChampions: {
      champions: bannedChampions,
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
      bestByType: {
        physical: agg.bestDamagePhysical,
        magical: agg.bestDamageMagical,
        trueDamage: agg.bestDamageTrue,
      },
    },
    damageTaken: {
      total: {
        physical: agg.totalDamageTakenPhysical,
        magical: agg.totalDamageTakenMagical,
        trueDamage: agg.totalDamageTakenTrue,
      },
      maxGame: globalMaxDamageTakenGame ?? noDamage,
      bestByType: {
        physical: agg.bestDamageTakenPhysical,
        magical: agg.bestDamageTakenMagical,
        trueDamage: agg.bestDamageTakenTrue,
      },
    },
    kills: {
      doubleKills: killsAgg.doubleKills,
      tripleKills: killsAgg.tripleKills,
      quadraKills: killsAgg.quadraKills,
      pentaKills: killsAgg.pentaKills,
      killingSprees: killsAgg.killingSprees,
      largestKillingSpree: killsAgg.largestKillingSpree,
      largestMultiKill: killsAgg.largestMultiKill,
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
    },
    utility: {
      totalHealingAndShielding: utilityAgg.totalHealingAndShielding,
      totalCcScoreSeconds: utilityAgg.totalCcScoreSeconds,
      totalCcTimeDealt: utilityAgg.totalCcTimeDealt,
      totalSavesFromDeath: utilityAgg.totalSavesFromDeath,
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
    },
    fun: {
      totalFistBumps: funAgg.totalFistBumps,
      totalPings,
      totalSkillshotsDodged: funAgg.totalSkillshotsDodged,
    },
    pings: {
      pings: pingTotals,
    },
    augments: {
      augments,
    },
    prismaticItems: {
      items: prismaticItems,
    },
    championCatalog: {
      champions: championCatalog,
    },
    championPicks: {
      champions: championPicks,
    },
    champions,
  };
}

export async function summonerRoutes(app: FastifyInstance) {
  app.get("/summoners", async () => {
    return db.select().from(summoners);
  });

  // Adds a new tracked summoner to the friend group (see CLAUDE.md §1 —
  // this is an admin action, not a public self-serve flow).
  app.post("/summoners", async (request, reply) => {
    const body = addSummonerSchema.parse(request.body);
    const account = await riot.getAccountByRiotId(body.gameName, body.tagLine, body.region);
    const summoner = await riot.getSummonerByPuuid(account.puuid, body.region);

    // Re-posting an already-tracked summoner refreshes their profile info
    // (icon/level change over time) rather than no-op-ing.
    const [row] = await db
      .insert(summoners)
      .values({
        puuid: account.puuid,
        riotIdGameName: account.gameName,
        riotIdTagline: account.tagLine,
        region: body.region,
        profileIconId: summoner.profileIconId,
        summonerLevel: summoner.summonerLevel,
      })
      .onConflictDoUpdate({
        target: summoners.puuid,
        set: {
          riotIdGameName: account.gameName,
          riotIdTagline: account.tagLine,
          profileIconId: summoner.profileIconId,
          summonerLevel: summoner.summonerLevel,
        },
      })
      .returning();

    reply.code(201);
    return row;
  });

  // Manual ingestion trigger for one tracked summoner — useful before the
  // background poll loop has run, or to force a refresh.
  app.post<{ Params: { puuid: string } }>("/summoners/:puuid/ingest", async (request, reply) => {
    const [summoner] = await db
      .select()
      .from(summoners)
      .where(eq(summoners.puuid, request.params.puuid));
    if (!summoner) {
      reply.code(404);
      return { error: "Summoner not tracked" };
    }
    return ingestSummoner(db, riot, summoner);
  });

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
    return buildSummonerStats(summoner);
  });

  // Same as above, keyed by Riot ID instead of puuid — this is what the
  // web app's /summoner/[platform]/[riotId] page actually uses, since a
  // profile URL built from puuid isn't something a person would type or
  // recognize. Case-insensitive since URLs get typed/shared by hand.
  app.get<{ Params: { region: string; gameName: string; tagLine: string } }>(
    "/summoners/by-riot-id/:region/:gameName/:tagLine/stats",
    async (request, reply) => {
      const { region, gameName, tagLine } = request.params;
      const [summoner] = await db
        .select()
        .from(summoners)
        .where(
          and(
            ilike(summoners.region, region),
            ilike(summoners.riotIdGameName, gameName),
            ilike(summoners.riotIdTagline, tagLine),
          ),
        );
      if (!summoner) {
        reply.code(404);
        return { error: "Summoner not tracked" };
      }
      return buildSummonerStats(summoner);
    },
  );
}
