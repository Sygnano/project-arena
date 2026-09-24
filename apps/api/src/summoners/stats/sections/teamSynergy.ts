import type { TeamSynergyChampionNode, TeamSynergyPairStats } from "@arena/types";
import { addToSplit, emptySplit, increment, type PlacementSplit } from "../aggregate.js";
import type { StatsData } from "../loadStatsData.js";

/** Champions drawn as their own arc; the rest fold into one "Other" arc. A
 * legibility cap, not a data cap: a friend group's history spans far more
 * champions than a chord diagram can label. */
const MAX_NAMED_CHAMPIONS = 20;
/** Teammate champions listed: seen on the summoner's team at least this often. */
const TEAMMATE_CHAMPIONS_MIN_GAMES = 2;
/** Games a pairing needs to be the "best pairing", so one lucky game can't
 * read as a 100% duo. Same minimum as the web app's `lib/sample.ts`. */
const BEST_PAIR_MIN_GAMES = 5;
/** The "Other" arc's id. Never a real champion id (Riot uses -1 for "none"). */
const OTHER_CHAMPION_ID = -1;

type PairTally = PlacementSplit & { aId: number; aName: string; bId: number; bName: string; games: number };

const top3Count = (split: PlacementSplit) => split.top1 + split.top3ExclTop1;

function toPairStats(pair: PairTally): TeamSynergyPairStats {
  return {
    championAName: pair.aName,
    championBName: pair.bName,
    gamesTogether: pair.games,
    top1: pair.top1,
    top3ExclTop1: pair.top3ExclTop1,
    remaining: pair.remaining,
    top3Rate: (top3Count(pair) / pair.games) * 100,
  };
}

/**
 * Which champions shared the summoner's team (their own pick included), how
 * each pairing did, and the chord diagram's matrices. Results are the team's
 * placement, which every member shares. `teamId` is only a per-match label,
 * so each match's roster is rebuilt from that match's participants.
 */
export function buildTeamSynergyStats({ games, participantsByMatch }: StatsData) {
  const gamesOnTeam = new Map<number, number>();
  const winsOnTeam = new Map<number, { top1: number; top3: number }>();
  const nameById = new Map<number, string>();
  const pairs = new Map<string, PairTally>();
  const teammateChampions = new Map<
    number,
    PlacementSplit & { championId: number; championName: string; games: number }
  >();

  for (const game of games) {
    // One entry per champion, in case a champion were ever on a team twice.
    const roster = new Map<number, string>();
    for (const player of participantsByMatch.get(game.matchId) ?? []) {
      if (player.teamId === game.teamId) roster.set(player.championId, player.championName);
    }

    for (const [championId, championName] of roster) {
      nameById.set(championId, championName);
      increment(gamesOnTeam, championId);
      const wins = winsOnTeam.get(championId) ?? { top1: 0, top3: 0 };
      if (game.placement === 1) wins.top1 += 1;
      if (game.placement <= 3) wins.top3 += 1;
      winsOnTeam.set(championId, wins);

      // Teammates' champions only: "which champions on my team go with my best results".
      if (championId !== game.championId) {
        let teammate = teammateChampions.get(championId);
        if (!teammate)
          teammateChampions.set(championId, (teammate = { championId, championName, games: 0, ...emptySplit() }));
        teammate.games += 1;
        addToSplit(teammate, game.placement);
      }
    }

    const ids = [...roster.keys()];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const aId = Math.min(ids[i]!, ids[j]!);
        const bId = Math.max(ids[i]!, ids[j]!);
        const key = `${aId}:${bId}`;
        let pair = pairs.get(key);
        if (!pair) {
          pair = { aId, aName: roster.get(aId)!, bId, bName: roster.get(bId)!, games: 0, ...emptySplit() };
          pairs.set(key, pair);
        }
        pair.games += 1;
        addToSplit(pair, game.placement);
      }
    }
  }

  const allPairs = [...pairs.values()];
  const mostPlayed = allPairs.reduce<PairTally | null>(
    (best, pair) => (!best || pair.games > best.games ? pair : best),
    null,
  );
  const best = allPairs
    .filter((pair) => pair.games >= BEST_PAIR_MIN_GAMES)
    .reduce<PairTally | null>(
      (top, pair) => (!top || top3Count(pair) / pair.games > top3Count(top) / top.games ? pair : top),
      null,
    );

  // Most games first; the ones past the cap share the "Other" arc.
  const sortedIds = [...gamesOnTeam].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([id]) => id);
  const namedIds = sortedIds.slice(0, MAX_NAMED_CHAMPIONS);
  const otherIds = sortedIds.slice(MAX_NAMED_CHAMPIONS);
  const champions: TeamSynergyChampionNode[] = namedIds.map((championId) => ({
    championId,
    championName: nameById.get(championId)!,
    gamesOnTeam: gamesOnTeam.get(championId)!,
    top1OnTeam: winsOnTeam.get(championId)?.top1 ?? 0,
    top3OnTeam: winsOnTeam.get(championId)?.top3 ?? 0,
    championCount: 1,
  }));
  if (otherIds.length > 0) {
    const sum = (get: (id: number) => number) => otherIds.reduce((total, id) => total + get(id), 0);
    champions.push({
      championId: OTHER_CHAMPION_ID,
      championName: "Other",
      gamesOnTeam: sum((id) => gamesOnTeam.get(id)!),
      top1OnTeam: sum((id) => winsOnTeam.get(id)?.top1 ?? 0),
      top3OnTeam: sum((id) => winsOnTeam.get(id)?.top3 ?? 0),
      championCount: otherIds.length,
    });
  }

  // Each champion's arc index: its own, or the shared "Other" one (last).
  const arcIndex = new Map<number, number>();
  namedIds.forEach((id, index) => arcIndex.set(id, index));
  for (const id of otherIds) arcIndex.set(id, namedIds.length);

  const emptyMatrix = () => champions.map(() => new Array<number>(champions.length).fill(0));
  const matrix = emptyMatrix();
  const matrixTop1 = emptyMatrix();
  const matrixTop3 = emptyMatrix();
  for (const pair of allPairs) {
    const a = arcIndex.get(pair.aId)!;
    const b = arcIndex.get(pair.bId)!;
    // Both in "Other": a ribbon needs two different arcs. Several real pairs
    // can land on one cell once "Other" is involved, so cells accumulate.
    if (a === b) continue;
    for (const [cells, value] of [
      [matrix, pair.games],
      [matrixTop1, pair.top1],
      [matrixTop3, top3Count(pair)],
    ] as const) {
      cells[a]![b]! += value;
      cells[b]![a]! += value;
    }
  }

  return {
    champions,
    matrix,
    matrixTop1,
    matrixTop3,
    totalDistinctChampions: gamesOnTeam.size,
    totalDistinctPairings: pairs.size,
    mostPlayedPairing: mostPlayed ? toPairStats(mostPlayed) : null,
    bestPairing: best ? toPairStats(best) : null,
    teammateChampions: [...teammateChampions.values()]
      .filter((champion) => champion.games >= TEAMMATE_CHAMPIONS_MIN_GAMES)
      .sort((a, b) => b.games - a.games || a.championId - b.championId),
  };
}
