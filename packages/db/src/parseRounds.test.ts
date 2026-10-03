import { describe, expect, it } from "vitest";
import { groupBy } from "./fixtures/group-by.js";
import { FIXTURE_MATCH_ID, loadFixtureMatch } from "./fixtures/index.js";
import { parseRounds } from "./parseRounds.js";

describe("parseRounds on a real match", () => {
  const { dto, timeline } = loadFixtureMatch();
  const rounds = parseRounds(FIXTURE_MATCH_ID, dto, timeline);
  const teamIds = new Set(dto.info.participants.map((p) => p.playerSubteamId));

  it("pairs real teams, never a team with itself", () => {
    expect(rounds.length).toBeGreaterThan(0);
    for (const round of rounds) {
      expect(teamIds.has(round.winnerTeamId)).toBe(true);
      expect(teamIds.has(round.loserTeamId)).toBe(true);
      expect(round.winnerTeamId).not.toBe(round.loserTeamId);
    }
  });

  it("puts each team in at most one duel per round", () => {
    for (const [, duels] of groupBy(rounds, (r) => r.roundNumber)) {
      const teams = duels.flatMap((d) => [d.winnerTeamId, d.loserTeamId]);
      expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it("matches the stored derivation", () => {
    expect(rounds).toMatchSnapshot();
  });
});
