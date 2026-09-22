import type { ChampionFormStats, ChampionPickBreakdown, ChampionStatsPayload } from "@arena/types";
import { addToSplit, avgOf, emptySplit, groupBy, kdaRatio, maxBy, maxOf, minOf, sumOf } from "../aggregate.js";
import type { OwnGame } from "../loadStatsData.js";
import { abilityCasts, damageStats, utilityStats } from "./gameTotals.js";

/** Per-champion inputs built by other sections. */
interface ChampionExtras {
  items: (championId: number) => ChampionStatsPayload["items"];
  augments: (championId: number) => ChampionStatsPayload["augments"];
}

/** Every game on the champion (newest first) and its top 3 streaks. */
function championForm(games: readonly OwnGame[]): ChampionFormStats {
  let current = 0;
  let longest = 0;
  for (const game of games) {
    current = game.placement <= 3 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return {
    games: games
      .map((game) => ({
        placement: game.placement,
        playedAt: game.gameCreation.toISOString(),
        kills: game.kills,
        deaths: game.deaths,
        assists: game.assists,
      }))
      .reverse(),
    currentWinStreak: current,
    longestWinStreak: longest,
  };
}

const anvilsOf = (game: OwnGame) => ({
  stat: game.statAnvilsBought ?? 0,
  legendary: game.legendaryAnvilsBought ?? 0,
  prismatic: game.prismaticAnvilsBought ?? 0,
});

/** One champion's dossier: every stat above, restricted to its games. */
function championStats(games: OwnGame[], worstPlacement: number, extras: ChampionExtras): ChampionStatsPayload {
  const { championId, championName } = games[0]!;
  // Placement histogram, as long as the worst placement the summoner ever had.
  const placementCounts = new Array<number>(worstPlacement).fill(0);
  for (const game of games) placementCounts[game.placement - 1]! += 1;
  const bestKdaGame = maxBy(games, (game) => kdaRatio(game.kills, game.deaths, game.assists));
  const mostAnvilsGame = maxBy(games, (game) => {
    const anvils = anvilsOf(game);
    return anvils.stat + anvils.legendary + anvils.prismatic;
  });

  return {
    championId,
    championName,
    matchesPlayed: games.length,
    timePlayedSeconds: sumOf(games, (game) => game.timePlayedSeconds),
    longestGameSeconds: maxOf(games, (game) => game.timePlayedSeconds),
    avgPlacement: avgOf(games, (game) => game.placement),
    placementCounts,
    items: extras.items(championId),
    form: championForm(games),
    augments: extras.augments(championId),
    combat: {
      doubleKills: sumOf(games, (game) => game.doubleKills),
      tripleKills: sumOf(games, (game) => game.tripleKills),
      quadraKills: sumOf(games, (game) => game.quadraKills),
      pentaKills: sumOf(games, (game) => game.pentaKills),
      largestCriticalStrike: maxOf(games, (game) => game.largestCriticalStrike),
      damageSelfMitigated: sumOf(games, (game) => game.damageSelfMitigated),
      mostDoubleKills: maxOf(games, (game) => game.doubleKills),
      mostTripleKills: maxOf(games, (game) => game.tripleKills),
      mostQuadraKills: maxOf(games, (game) => game.quadraKills),
      mostPentaKills: maxOf(games, (game) => game.pentaKills),
      bestDamageSelfMitigated: maxOf(games, (game) => game.damageSelfMitigated),
    },
    economy: {
      goldEarned: sumOf(games, (game) => game.goldEarned),
      bestGameGoldEarned: maxOf(games, (game) => game.goldEarned),
      itemsPurchased: sumOf(games, (game) => game.itemsPurchased),
      statAnvilsBought: sumOf(games, (game) => game.statAnvilsBought),
      legendaryAnvilsBought: sumOf(games, (game) => game.legendaryAnvilsBought),
      prismaticAnvilsBought: sumOf(games, (game) => game.prismaticAnvilsBought),
      mostItemsPurchased: maxOf(games, (game) => game.itemsPurchased),
      maxGameAnvils: mostAnvilsGame ? anvilsOf(mostAnvilsGame) : { stat: 0, legendary: 0, prismatic: 0 },
    },
    kda: {
      totalKills: sumOf(games, (game) => game.kills),
      totalDeaths: sumOf(games, (game) => game.deaths),
      totalAssists: sumOf(games, (game) => game.assists),
      // One real game's line, not per-stat maxima from different games.
      bestGame: bestKdaGame
        ? { kills: bestKdaGame.kills, deaths: bestKdaGame.deaths, assists: bestKdaGame.assists }
        : { kills: 0, deaths: 0, assists: 0 },
      soloKills: sumOf(games, (game) => game.soloKills),
      largestKillingSpree: maxOf(games, (game) => game.largestKillingSpree),
      mostKills: maxOf(games, (game) => game.kills),
      mostDeaths: maxOf(games, (game) => game.deaths),
      fewestDeaths: minOf(games, (game) => game.deaths),
      mostAssists: maxOf(games, (game) => game.assists),
      mostSoloKills: maxOf(games, (game) => game.soloKills),
    },
    damage: damageStats(games, "dealt"),
    damageTaken: damageStats(games, "taken"),
    ability: abilityCasts(games),
    utility: utilityStats(games),
  };
}

/** The champion dossiers and the picks chart. */
export function buildChampionStats(games: readonly OwnGame[], extras: ChampionExtras) {
  const worstPlacement = Math.max(0, ...games.map((game) => game.placement));
  const byChampion = groupBy(games, (game) => game.championId);

  const champions: Record<number, ChampionStatsPayload> = {};
  const championPicks: ChampionPickBreakdown[] = [];
  for (const [championId, championGames] of byChampion) {
    champions[championId] = championStats(championGames, worstPlacement, extras);
    const split = emptySplit();
    for (const game of championGames) addToSplit(split, game.placement);
    championPicks.push({
      championId,
      championName: championGames[0]!.championName,
      timesPicked: championGames.length,
      ...split,
    });
  }
  championPicks.sort((a, b) => b.timesPicked - a.timesPicked || a.championId - b.championId);

  return {
    champions,
    championPicks: { champions: championPicks },
  };
}
