"use client";

import type { CalendarStats } from "@arena/types";
import {
  HoverCardChampions,
  HoverCardRows,
  HoverCardSection,
  HoverStatCard,
} from "@/features/recap/components/hover-stat-card";
import { formatDuration } from "@/utils/format";
import { edgeFor, games } from "@/features/recap/components/slides/time-played/utils";
import { pad, percent } from "./utils";

function HourHoverCard({ calendar, hour }: { calendar: CalendarStats; hour: number }) {
  const gamesPlayed = calendar.gamesByHour[hour] ?? 0;
  const totalGames = calendar.gamesByHour.reduce((sum, count) => sum + count, 0);
  const top1 = calendar.top1ByHour[hour] ?? 0;
  const top3 = calendar.top3ByHour[hour] ?? 0;
  const avgPlacement = calendar.avgPlacementByHour[hour];
  const kda = calendar.kdaByHour?.[hour];
  const avgGameSeconds = calendar.avgGameSecondsByHour?.[hour];
  const champions = calendar.championsByHour?.[hour] ?? [];

  return (
    <HoverStatCard
      title={`${pad(hour)}:00–${pad((hour + 1) % 24)}:00`}
      meta={games(gamesPlayed)}
      subtitle={`UTC · ${totalGames > 0 ? percent(gamesPlayed, totalGames) : "0%"} of all games`}
      edgeColor={edgeFor(top1, top3)}
    >
      {gamesPlayed > 0 ? (
        <>
          <HoverCardSection>
            <HoverCardRows
              rows={[
                { label: "WINS", value: `${top3} · ${percent(top3, gamesPlayed)}` },
                { label: "1ST", value: `${top1} · ${percent(top1, gamesPlayed)}` },
                { label: "AVG PLACEMENT", value: avgPlacement == null ? "—" : avgPlacement.toFixed(2) },
                { label: "KDA", value: kda == null ? "—" : kda.toFixed(2) },
                {
                  label: "GAME LENGTH",
                  value: avgGameSeconds == null ? "—" : formatDuration(avgGameSeconds),
                },
              ]}
            />
          </HoverCardSection>
          {champions.length > 0 ? (
            <HoverCardSection label="MOST PLAYED">
              <HoverCardChampions champions={champions} />
            </HoverCardSection>
          ) : null}
        </>
      ) : null}
    </HoverStatCard>
  );
}

export { HourHoverCard };
