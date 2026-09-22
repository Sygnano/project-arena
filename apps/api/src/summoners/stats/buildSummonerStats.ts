import type { Summoner } from "@arena/db";
import type { SummonerStatsPayload } from "@arena/types";
import { getAugmentCatalog, getChampionCatalog, getItemCatalog, getSummonerSpells } from "../../leagueData/index.js";
import { loadStatsData, type StatsData } from "./loadStatsData.js";
import { buildActivityStats } from "./sections/activity.js";
import { buildAugmentStats } from "./sections/augments.js";
import { buildBanStats } from "./sections/bans.js";
import { buildChampionStats } from "./sections/champions.js";
import { buildCombatStats } from "./sections/combat.js";
import { buildDamageCurveStats } from "./sections/damageCurves.js";
import { buildEconomyStats } from "./sections/economy.js";
import { buildItemStats } from "./sections/items.js";
import { buildPeopleStats } from "./sections/people.js";
import { buildPlacementStats, buildTeamSlotStats } from "./sections/placements.js";
import { buildSummonerSpellStats } from "./sections/summonerSpells.js";
import { buildTeamSynergyStats } from "./sections/teamSynergy.js";

/**
 * Champion id -> Riot key, for ids that only come as numbers (bans, augment
 * hover cards): the names seen in these games first, then the champion list,
 * which also covers a champion banned in every game (never played, so never
 * in the games).
 */
function championKeyLookup(data: StatsData, catalogKeys: ReadonlyMap<number, string>) {
  const seen = new Map<number, string>();
  for (const players of data.participantsByMatch.values()) {
    for (const player of players) seen.set(player.championId, player.championName);
  }
  return (championId: number) => seen.get(championId) ?? catalogKeys.get(championId) ?? `Champion ${championId}`;
}

/**
 * A summoner's whole recap: three queries, then every section built in
 * memory. Items and augments are sent as ids, and the champion list and
 * display names aren't sent at all: the web app has them in its catalog
 * (`GET /catalog`).
 */
export async function buildSummonerStats(summoner: Summoner): Promise<SummonerStatsPayload> {
  const [data, champions, items, augments, spells] = await Promise.all([
    loadStatsData(summoner.puuid),
    getChampionCatalog(),
    getItemCatalog(),
    getAugmentCatalog(),
    getSummonerSpells(),
  ]);
  const { games } = data;
  const championKey = championKeyLookup(data, champions.keysById);

  const combat = buildCombatStats(games);
  const activity = buildActivityStats(games);
  const people = buildPeopleStats(data, summoner.puuid);
  const augmentStats = buildAugmentStats(games, augments, championKey);
  const itemStats = buildItemStats(games, items);
  const championStats = buildChampionStats(games, {
    items: itemStats.championItems,
    augments: augmentStats.championAugments,
  });

  return {
    profile: {
      riotIdGameName: summoner.riotIdGameName,
      riotIdTagline: summoner.riotIdTagline,
      region: summoner.region,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      matchesPlayed: games.length,
    },
    kda: combat.kda,
    timePlayed: activity.timePlayed,
    calendar: activity.calendar,
    placements: buildPlacementStats(games),
    teamSlot: buildTeamSlotStats(games),
    teamSynergy: buildTeamSynergyStats(data),
    teammates: people.teammates,
    nemesis: people.nemesis,
    versus: people.versus,
    bannedChampions: buildBanStats(data, championKey),
    damage: combat.damage,
    damageTaken: combat.damageTaken,
    kills: combat.kills,
    economy: buildEconomyStats(games, items, itemStats.shardblade),
    utility: combat.utility,
    ability: combat.ability,
    summonerSpells: buildSummonerSpellStats(games, spells),
    damageCurves: buildDamageCurveStats(games),
    fun: combat.fun,
    pings: combat.pings,
    augments: augmentStats.augments,
    augmentPicks: augmentStats.augmentPicks,
    guestOfHonor: augmentStats.guestOfHonor,
    metaAugments: augmentStats.metaAugments,
    specialItems: itemStats.specialItems,
    legendaryItems: itemStats.legendaryItems,
    prismaticItems: itemStats.prismaticItems,
    prismaticItemPicks: itemStats.prismaticItemPicks,
    boots: itemStats.boots,
    championPicks: championStats.championPicks,
    champions: championStats.champions,
    lastMatchAt: games.at(-1)?.gameCreation.toISOString() ?? null,
  };
}
