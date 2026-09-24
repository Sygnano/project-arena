"use client";

import type { CalendarDayStats, CalendarStats } from "@arena/types";
import { HoverCardChampions, HoverCardRows, HoverCardSection, HoverStatCard } from "@/components/hover-stat-card";
import { PlacementPips } from "@/components/placement-pips";
import { formatDuration, ordinal } from "@/lib/format";
import { TIER_STYLE } from "@/lib/tier-bars";

const DAY_TITLE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function games(count: number) {
  return `${count.toLocaleString()} game${count === 1 ? "" : "s"}`;
}

/** Edge color by the best result the card covers, like the cells and bars. */
function edgeFor(top1: number, top3: number) {
  if (top1 > 0) return TIER_STYLE.prismatic.edge;
  if (top3 > 0) return TIER_STYLE.gold.edge;
  return TIER_STYLE.silver.edge;
}

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

function pad(hour: number) {
  return String(hour).padStart(2, "0");
}

function percent(part: number, whole: number) {
  return `${((part / whole) * 100).toFixed(0)}%`;
}

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

export { DayHoverCard, HourHoverCard };
