import type { RiotArenaMatchDto, RiotMatchTimelineDto } from "@arena/types";
import type { matchRounds } from "./schema.js";

type NewMatchRound = typeof matchRounds.$inferInsert;

/**
 * A pause between two CHAMPION_KILL events longer than this starts a new
 * round. Measured across 341 matches / 45,917 kills: kill gaps are cleanly
 * bimodal — inside a fight almost all are under 30s (only 20 of ~41,000
 * fall in 30-40s), while the shop phase between rounds puts the next kill
 * 55-125s later. 40s sits in the empty valley between the two.
 */
const ROUND_GAP_MS = 40_000;

interface Kill {
  timestamp: number;
  killerTeam: number | undefined;
  victimTeam: number;
  victimId: number;
}

/**
 * Reconstructs every round's duels from timeline CHAMPION_KILL events.
 *
 * Riot sends no per-round data. `CHAMPION_SPECIAL_KILL` / `KILL_ACE` looks
 * like it should mark a round, but it doesn't: it fires only 4-6 times per
 * match (vs ~30 duels) and carries no victim team, e.g. a team wiped at
 * 121-126s got no ace while another wipe 4s later did. So rounds are
 * derived instead:
 *
 * 1. Kills are split into rounds on `ROUND_GAP_MS` pauses.
 * 2. Inside a round, a kill between two teams pairs them into a duel.
 *    A round whose kills pair a team with two different opponents is
 *    ambiguous (two rounds merged across a short gap) and skipped — 5 of
 *    4,610 rounds in the dataset.
 * 3. The loser is the team whose every member died in that duel. With
 *    revives both teams can be fully wiped (333 of 10,580 duels); then the
 *    team with the last death lost, since the round ends on it. A duel
 *    where neither team was wiped (3 in the dataset, a final round split
 *    by a long gap) is skipped rather than guessed.
 *
 * Teams on a bye in an odd round fight a ghost, which emits no kill events,
 * so those never appear as duels. Team size comes from the match itself,
 * never a constant (CLAUDE.md §2).
 */
export function parseRounds(
  matchId: string,
  dto: RiotArenaMatchDto,
  timelineDto: RiotMatchTimelineDto,
): NewMatchRound[] {
  const teamByParticipantId = new Map<number, number>();
  const teamSize = new Map<number, number>();
  // Timeline participantIds join through puuid, not array position.
  const teamByPuuid = new Map(dto.info.participants.map((p) => [p.puuid, p.playerSubteamId]));
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
      // Deaths with no enemy killer (killerId 0, or a same-team credit)
      // still count toward a wipe below, but can't pair teams.
      if (killerTeam === undefined || killerTeam === victimTeam) continue;
      for (const [a, b] of [[killerTeam, victimTeam], [victimTeam, killerTeam]] as const) {
        const known = opponentOf.get(a);
        if (known !== undefined && known !== b) ambiguous = true;
        opponentOf.set(a, b);
      }
    }
    if (ambiguous) return;

    for (const [teamA, teamB] of opponentOf) {
      if (teamA > teamB) continue; // each duel appears once per side
      const duelKills = round.filter((k) => k.victimTeam === teamA || k.victimTeam === teamB);
      const wiped = (team: number) =>
        new Set(duelKills.filter((k) => k.victimTeam === team).map((k) => k.victimId)).size >=
        (teamSize.get(team) ?? Infinity);
      const aWiped = wiped(teamA);
      const bWiped = wiped(teamB);
      if (!aWiped && !bWiped) continue;

      const loser =
        aWiped && bWiped ? duelKills[duelKills.length - 1]!.victimTeam : aWiped ? teamA : teamB;
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
