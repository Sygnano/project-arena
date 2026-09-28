"use client";

import type { CalendarDayStats } from "@arena/types";
import {
  HoverCardChampions,
  HoverCardRows,
  HoverCardSection,
  HoverStatCard,
} from "@/features/recap/components/hover-stat-card";
import { formatDuration, ordinal } from "@/utils/format";
import { edgeFor, games } from "@/features/recap/components/slides/time-played/utils";
import { PlacementPips } from "./components/placement-pips";
import { DAY_TITLE } from "./constants";

function DayHoverCard({ day }: { day: CalendarDayStats }) {
  return (
    <HoverStatCard
      title={DAY_TITLE.format(new Date(`${day.date}T00:00:00Z`)).toUpperCase()}
      meta={games(day.gamesPlayed)}
      subtitle={`${formatDuration(day.timePlayedSeconds)} played · UTC day`}
      edgeColor={edgeFor(day.top1Finishes ?? 0, day.top3Finishes ?? 0)}
    >
      {day.placements?.length ? (
        <HoverCardSection label="PLACEMENTS IN ORDER">
          <PlacementPips
            placements={day.placements}
            size="sm"
            className="justify-start"
            ariaLabel={`Placements in play order: ${day.placements.map(ordinal).join(", ")}`}
          />
        </HoverCardSection>
      ) : null}
      <HoverCardSection>
        <HoverCardRows
          rows={[
            { label: "WINS", value: `${day.top3Finishes ?? "—"} · ${day.top3Rate.toFixed(0)}%` },
            { label: "1ST", value: day.top1Finishes?.toLocaleString() ?? "—" },
            { label: "AVG PLACEMENT", value: day.avgPlacement.toFixed(2) },
            { label: "KDA", value: day.kda?.toFixed(2) ?? "—" },
          ]}
        />
      </HoverCardSection>
      {day.champions?.length ? (
        <HoverCardSection label="MOST PLAYED">
          <HoverCardChampions champions={day.champions} />
        </HoverCardSection>
      ) : null}
    </HoverStatCard>
  );
}

export { DayHoverCard };
