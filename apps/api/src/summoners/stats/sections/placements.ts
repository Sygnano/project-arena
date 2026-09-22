import type { PlacementDetail, TeamSlotBreakdown } from "@arena/types";
import { addToSplit, avgOf, emptySplit, flooredKda, groupBy, increment, sumOf } from "../aggregate.js";
import type { OwnGame } from "../loadStatsData.js";

/** A champion needs this many games before it can be a placement's "top
 * champion" (the web app's `lib/sample.ts` minimum), so one game can't claim 100%. */
const TOP_CHAMPION_MIN_GAMES = 5;

/**
 * The champion whose games end at each placement most often, as a share of
 * that champion's own games (the plain most-played champion would just be
 * the summoner's main at every placement). Ties go to the one with more games.
 */
function topChampionByPlacement(games: readonly OwnGame[]) {
  const gamesByChampion = new Map<string, number>();
  const countByPlacementChampion = new Map<number, Map<string, number>>();
  for (const game of games) {
    increment(gamesByChampion, game.championName);
    let counts = countByPlacementChampion.get(game.placement);
    if (!counts) countByPlacementChampion.set(game.placement, (counts = new Map()));
    increment(counts, game.championName);
  }

  const top = new Map<number, NonNullable<PlacementDetail["topChampion"]>>();
  for (const [placement, counts] of countByPlacementChampion) {
    for (const [championName, count] of counts) {
      const totalGames = gamesByChampion.get(championName) ?? 0;
      if (totalGames < TOP_CHAMPION_MIN_GAMES) continue;
      const current = top.get(placement);
      const rate = count / totalGames;
      const currentRate = current ? current.games / current.totalGames : -1;
      if (rate > currentRate || (current && rate === currentRate && count > current.games)) {
        top.set(placement, { championName, games: count, totalGames });
      }
    }
  }
  return top;
}

/** Longest run of consecutive games (in play order) passing `test`. */
function longestRun(games: readonly OwnGame[], test: (game: OwnGame) => boolean) {
  let longest = 0;
  let current = 0;
  for (const game of games) {
    current = test(game) ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

/** Finishing places: counts, what a typical game at each place looks like, and streaks. */
export function buildPlacementStats(games: readonly OwnGame[]) {
  // Zero-filled from 1st to the worst place seen, so a place never reached
  // still gets its column. The range comes from the data, never from a team
  // count (CLAUDE.md §2).
  const worstPlacement = Math.max(0, ...games.map((game) => game.placement));
  const byPlacement: Record<number, number> = {};
  for (let placement = 1; placement <= worstPlacement; placement++) byPlacement[placement] = 0;

  const topChampions = topChampionByPlacement(games);
  const detailsByPlacement: Record<number, PlacementDetail> = {};
  for (const [placement, placementGames] of groupBy(games, (game) => game.placement)) {
    byPlacement[placement] = placementGames.length;
    detailsByPlacement[placement] = {
      avgGameSeconds: avgOf(placementGames, (game) => game.timePlayedSeconds),
      kda: flooredKda(
        sumOf(placementGames, (game) => game.kills),
        sumOf(placementGames, (game) => game.deaths),
        sumOf(placementGames, (game) => game.assists),
      ),
      avgDamage: avgOf(placementGames, (game) => game.damageDealtToChampions),
      avgAugments: avgOf(placementGames, (game) => game.augments.length),
      topChampion: topChampions.get(placement) ?? null,
    };
  }

  return {
    avgPlacement: avgOf(games, (game) => game.placement),
    top3Finishes: games.filter((game) => game.placement <= 3).length,
    top1Finishes: byPlacement[1] ?? 0,
    byPlacement,
    detailsByPlacement,
    longestWinStreak: longestRun(games, (game) => game.placement <= 3),
    longestTop1Streak: longestRun(games, (game) => game.placement === 1),
  };
}

/**
 * Results by lobby slot (`teamId`, Riot's playerSubteamId): an arbitrary
 * per-match label, grouped only to see whether a slot skews results.
 */
export function buildTeamSlotStats(games: readonly OwnGame[]) {
  const byTeamId: TeamSlotBreakdown[] = [...groupBy(games, (game) => game.teamId)]
    .map(([teamId, slotGames]) => {
      const split = emptySplit();
      const byPlacement: Record<number, number> = {};
      for (const game of slotGames) {
        addToSplit(split, game.placement);
        byPlacement[game.placement] = (byPlacement[game.placement] ?? 0) + 1;
      }
      return {
        teamId,
        ...split,
        avgPlacement: avgOf(slotGames, (game) => game.placement),
        kda: flooredKda(
          sumOf(slotGames, (game) => game.kills),
          sumOf(slotGames, (game) => game.deaths),
          sumOf(slotGames, (game) => game.assists),
        ),
        byPlacement,
      };
    })
    .sort((a, b) => a.teamId - b.teamId);
  return { byTeamId };
}
