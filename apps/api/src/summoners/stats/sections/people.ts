import type { OpponentStats, TeammateStats } from "@arena/types";
import { addToSplit, emptySplit, type PlacementSplit } from "../aggregate.js";
import type { CoParticipant, StatsData } from "../loadStatsData.js";

/** Players met only once are left out of the lists: a one-off matchmade
 * name carries no signal and made up 94% of teammates and 86% of opponents
 * on real data. The true totals still ship. */
const MIN_SHARED_GAMES_LISTED = 2;

type Rounds = { roundsWon: number; roundsLost: number };
type Named = { riotIdGameName: string | null; riotIdTagline: string | null };

type TeammateTally = PlacementSplit & Rounds & Named & { gamesPlayed: number };
type OpponentTally = PlacementSplit &
  Rounds &
  Named & { gamesFaced: number; ownTop1: number; ownTop3ExclTop1: number; timesBeat: number; timesBeatenBy: number };
type VersusTally = { championId: number; championName: string; duelsWon: number; duelsLost: number; matches: Set<string> };

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) map.set(key, (value = create()));
  return value;
}

/** The player's Riot ID as of their latest game with the summoner (games are
 * walked oldest first, so the last write wins). Riot IDs change; champions don't. */
function rememberName(tally: Named, player: CoParticipant) {
  tally.riotIdGameName = player.riotIdGameName;
  tally.riotIdTagline = player.riotIdTagline;
}

/**
 * The real accounts on the summoner's team (teammates) and against them
 * (opponents), and duel records per opponent champion (versus). Duels come
 * from `match_rounds`: a match without a timeline has none, so round counts
 * can be 0 even when games aren't.
 */
export function buildPeopleStats({ games, participantsByMatch, roundsByMatch }: StatsData, puuid: string) {
  const teammates = new Map<string, TeammateTally>();
  const opponents = new Map<string, OpponentTally>();
  const versus = new Map<number, VersusTally>();
  let duelsWon = 0;
  let duelsLost = 0;

  for (const game of games) {
    const players = participantsByMatch.get(game.matchId) ?? [];
    for (const player of players) {
      if (player.puuid === puuid) continue;
      if (player.teamId === game.teamId) {
        const tally = getOrCreate(teammates, player.puuid, () => ({
          gamesPlayed: 0, roundsWon: 0, roundsLost: 0, riotIdGameName: null, riotIdTagline: null, ...emptySplit(),
        }));
        tally.gamesPlayed += 1;
        addToSplit(tally, game.placement);
        rememberName(tally, player);
      } else {
        const tally = getOrCreate(opponents, player.puuid, () => ({
          gamesFaced: 0, ownTop1: 0, ownTop3ExclTop1: 0, timesBeat: 0, timesBeatenBy: 0,
          roundsWon: 0, roundsLost: 0, riotIdGameName: null, riotIdTagline: null, ...emptySplit(),
        }));
        tally.gamesFaced += 1;
        addToSplit(tally, player.placement);
        if (game.placement === 1) tally.ownTop1 += 1;
        else if (game.placement <= 3) tally.ownTop3ExclTop1 += 1;
        // A lower placement is better: 1st beats 2nd.
        if (game.placement < player.placement) tally.timesBeat += 1;
        if (game.placement > player.placement) tally.timesBeatenBy += 1;
        rememberName(tally, player);
      }
    }

    for (const round of roundsByMatch.get(game.matchId) ?? []) {
      const won = round.winnerTeamId === game.teamId;
      if (!won && round.loserTeamId !== game.teamId) continue;
      if (won) duelsWon += 1;
      else duelsLost += 1;
      const enemyTeamId = won ? round.loserTeamId : round.winnerTeamId;
      for (const player of players) {
        if (player.puuid === puuid) continue;
        let tally: Rounds | undefined;
        if (player.teamId === game.teamId) tally = teammates.get(player.puuid);
        else if (player.teamId === enemyTeamId) {
          tally = opponents.get(player.puuid);
          const champion = getOrCreate(versus, player.championId, () => ({
            championId: player.championId, championName: player.championName, duelsWon: 0, duelsLost: 0, matches: new Set<string>(),
          }));
          if (won) champion.duelsWon += 1;
          else champion.duelsLost += 1;
          champion.matches.add(game.matchId);
        }
        if (!tally) continue;
        if (won) tally.roundsWon += 1;
        else tally.roundsLost += 1;
      }
    }
  }

  const listed = <T extends Named>(tallies: Map<string, T>, games: (tally: T) => number) =>
    [...tallies]
      .filter(([, tally]) => games(tally) >= MIN_SHARED_GAMES_LISTED)
      .sort((a, b) => games(b[1]) - games(a[1]) || (a[0] < b[0] ? -1 : 1))
      // PUUIDs stay server-side: the page only needs a row key.
      .map(([, { riotIdGameName, riotIdTagline, ...tally }], id) => ({
        id,
        riotIdGameName: riotIdGameName ?? "Unknown",
        riotIdTagline: riotIdTagline ?? "????",
        ...tally,
      }));

  return {
    teammates: {
      teammates: listed(teammates, (tally) => tally.gamesPlayed) satisfies TeammateStats[],
      totalTeammates: teammates.size,
    },
    nemesis: {
      opponents: listed(opponents, (tally) => tally.gamesFaced) satisfies OpponentStats[],
      totalOpponents: opponents.size,
    },
    versus: {
      champions: [...versus.values()]
        .map(({ matches, ...champion }) => ({ ...champion, gamesFaced: matches.size }))
        .sort((a, b) => b.duelsWon + b.duelsLost - (a.duelsWon + a.duelsLost) || a.championId - b.championId),
      duelsWon,
      duelsLost,
    },
  };
}
