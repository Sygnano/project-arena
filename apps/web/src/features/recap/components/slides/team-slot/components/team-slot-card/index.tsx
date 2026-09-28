"use client";

import type { TeamSlotBreakdown, TeamSlotStats } from "@arena/types";
import { formatSignedPoints } from "@/components/delta-cell";
import {
  HoverStatCard,
  HoverCardSection,
  HoverCardRows,
  HoverCardPlacementBars,
} from "@/features/recap/components/hover-stat-card";
import { isLowSample } from "@/features/recap/utils/sample";
import { TEAM_NAME } from "@/features/recap/components/slides/team-slot/constants";
import { percent, slotGames } from "./utils";

/** Hover card for one slot: its record against the summoner's overall one
 * (a slot is an arbitrary lobby label, so the question is whether it skews),
 * then how its matches spread across every exact placement. */
function TeamSlotCard({ row, teamSlot }: { row: TeamSlotBreakdown; teamSlot: TeamSlotStats }) {
  const games = slotGames(row);
  const allGames = teamSlot.byTeamId.reduce((sum, team) => sum + slotGames(team), 0);
  const allWins = teamSlot.byTeamId.reduce((sum, team) => sum + team.top1 + team.top3ExclTop1, 0);
  const allFirsts = teamSlot.byTeamId.reduce((sum, team) => sum + team.top1, 0);
  const wins = row.top1 + row.top3ExclTop1;
  const winRate = percent(wins, games);
  const firstRate = percent(row.top1, games);
  const lowSample = isLowSample(games);

  // Every placement seen in any slot, so each card lists the same rows.
  const worstPlacement = Math.max(
    1,
    ...teamSlot.byTeamId.flatMap((team) => Object.keys(team.byPlacement ?? {}).map(Number)),
  );
  const placements = Array.from({ length: worstPlacement }, (_, index) => index + 1);

  return (
    <HoverStatCard
      title={`TEAM ${(TEAM_NAME[row.teamId] ?? String(row.teamId)).toUpperCase()}`}
      meta={`${games.toLocaleString()} game${games === 1 ? "" : "s"}`}
      subtitle={`${percent(games, allGames).toFixed(0)}% of all games${lowSample ? " · few games" : ""}`}
      edgeColor="rgba(10,200,185,.75)"
    >
      <HoverCardSection>
        <HoverCardRows
          rows={[
            {
              label: "WINRATE",
              value: (
                <>
                  {winRate.toFixed(0)}%
                  <span className="ml-1.5 text-[11px] text-lol-text-muted">
                    {formatSignedPoints(winRate - percent(allWins, allGames))}
                  </span>
                </>
              ),
            },
            {
              label: "1ST RATE",
              value: (
                <>
                  {firstRate.toFixed(0)}%
                  <span className="ml-1.5 text-[11px] text-lol-text-muted">
                    {formatSignedPoints(firstRate - percent(allFirsts, allGames))}
                  </span>
                </>
              ),
            },
            { label: "AVG PLACEMENT", value: row.avgPlacement?.toFixed(2) ?? "—" },
            { label: "KDA", value: row.kda?.toFixed(2) ?? "—" },
          ]}
        />
      </HoverCardSection>
      {row.byPlacement ? (
        <HoverCardSection label="FINISHES">
          <HoverCardPlacementBars counts={placements.map((placement) => row.byPlacement[placement] ?? 0)} />
        </HoverCardSection>
      ) : null}
    </HoverStatCard>
  );
}

export { TeamSlotCard };
