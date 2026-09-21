"use client";

import type { TeamSlotBreakdown, TeamSlotStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { formatSignedPoints } from "@/components/delta-cell";
import {
  HoverCardPlacementBars,
  HoverCardRows,
  HoverCardSection,
  HoverStatCard,
} from "@/components/hover-stat-card";
import { HextechPanel } from "@/components/hextech-panel";
import {
  HextechBarChart,
  type BarColumn,
} from "@/components/hextech-bar-chart";
import { useChartHover } from "@/hooks/use-chart-hover";
import { isLowSample } from "@/lib/sample";
import { FadingRule } from "@/components/fading-rule";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { TIER_STYLE } from "@/lib/tier-bars";

type Props = {
  teamSlot: TeamSlotStats;
};

// Arena's 8 lobby "teams" each have a jungle-camp crest (Poro, Wolf, Minion,
// Krug, Raptor, Scuttle, Sentinel, Gromp — see the match history client's own
// `subteams/*.svg` assets, linked below). Riot's Match-V5 API never sends
// this identity (only the bare numeric `playerSubteamId`), so it can't be
// verified against our own ingested data the way everything else in this
// codebase is — this mapping is taken on the user's own in-game knowledge,
// confirmed 1-6 only (the current 6-team format, see CLAUDE.md §2 on team
// size). 7/8 (Wolf/Gromp) are left out rather than guessed at an unconfirmed
// order, since teamId can't currently exceed 6 anyway.
const TEAM_ICON_SLUG: Record<number, string> = {
  1: "poro",
  2: "minion",
  3: "scuttle",
  4: "krug",
  5: "raptor",
  6: "sentinel",
};

const TEAM_NAME: Record<number, string> = {
  1: "Poro",
  2: "Minion",
  3: "Scuttle",
  4: "Krug",
  5: "Raptor",
  6: "Sentinel",
};

function teamIconUrl(slug: string): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/images/subteams/${slug}.svg`;
}

// Percent of the chart's bar track the tallest column fills, leaving room
// for its total label above. Percent (not px) so the chart follows the
// panel's real height instead of overflowing it on shorter screens.
const BAR_MAX_PERCENT = 78;

/**
 * Same three rarity tiers `HextechBarChart`'s KDA columns use for their top
 * 3 ranks, applied here by FIXED meaning instead of rank: every team's 1st
 * segment is Prismatic, 2nd-3rd is Gold, and the rest is Silver, regardless
 * of which team has the most of each. `borderColor`/`boxShadow` mirror
 * `KDA/index.tsx`'s `BAR_TIER` table exactly (same tokens, same reasoning
 * for why they're still needed alongside `fillClassName`).
 */
const SEGMENT_TIER = {
  top1: TIER_STYLE.prismatic,
  top3: TIER_STYLE.gold,
  remaining: TIER_STYLE.silver,
};

/**
 * Builds one stacked column per team slot — 1st-place finishes on top
 * (Prismatic), 2nd-3rd in the middle (Gold), everything else at the bottom
 * (Silver), tallest-total team setting the scale for all six so their
 * relative sizes stay comparable. Each segment gets an in-bar value label
 * (dropped by `HextechBarChart` itself when the segment's too short to fit
 * one legibly); the hover card (`TeamSlotCard`) carries every exact count,
 * so a sliver-thin segment's number is still reachable.
 */
function buildTeamSlotColumns(teamSlot: TeamSlotStats): BarColumn[] {
  const totals = teamSlot.byTeamId.map(
    (row) => row.top1 + row.top3ExclTop1 + row.remaining,
  );
  const maxTotal = Math.max(1, ...totals);
  const scale = BAR_MAX_PERCENT / maxTotal;

  return teamSlot.byTeamId.map((row) => {
    const total = row.top1 + row.top3ExclTop1 + row.remaining;
    const slug = TEAM_ICON_SLUG[row.teamId];

    const segments = (
      [
        ["1st", row.top1, SEGMENT_TIER.top1],
        ["2nd-3rd", row.top3ExclTop1, SEGMENT_TIER.top3],
        ["remaining", row.remaining, SEGMENT_TIER.remaining],
      ] as const
    )
      .map(([key, value, tier]) => ({
        key,
        value,
        height: value * scale,
        label: value > 0 ? String(value) : undefined,
        fillClassName: tier.fillClass,
        borderColor: tier.edge,
        boxShadow: tier.glow,
      }))
      // A 0-value segment would still paint a stray `border-top` line at
      // height 0 (a border isn't clipped away just because its box has no
      // height) — dropped instead of rendered, rather than trying to hide
      // it with more CSS.
      .filter((segment) => segment.height > 0);

    return {
      id: row.teamId,
      topLabel: total.toLocaleString(),
      icon: slug ? (
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="my-2 flex h-12.5 w-12.5 rotate-45 items-center justify-center border"
            style={{
              borderColor: "rgba(10,200,185,.75)",
              boxShadow: "0 0 18px rgba(10,200,185,.3)",
              background: "rgba(5,14,22,.75)",
            }}
          >
            <div className="font-display -rotate-45 text-[15px] tracking-[.04em] text-lol-gold-50">
              <img
                loading="lazy"
                decoding="async"
                src={teamIconUrl(slug)}
                alt=""
                width={36}
                height={36}
              />
            </div>
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs tracking-[.22em] text-lol-text-muted">
            <span className="h-px w-3 bg-[rgba(200,170,110,.4)]" />
            TEAM
            <span className="h-px w-3 bg-[rgba(200,170,110,.4)]" />
          </div>
          <div className="mt-1 text-sm font-semibold tracking-[.22em] text-lol-gold-100 uppercase">
            {TEAM_NAME[row.teamId] ?? `Team ${row.teamId}`}
          </div>
        </div>
      ) : undefined,
      fallbackLabel: `Team ${row.teamId}`,
      segments,
    };
  });
}

function slotGames(row: TeamSlotBreakdown) {
  return row.top1 + row.top3ExclTop1 + row.remaining;
}

function percent(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

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
          <HoverCardPlacementBars
            counts={placements.map((placement) => row.byPlacement[placement] ?? 0)}
          />
        </HoverCardSection>
      ) : null}
    </HoverStatCard>
  );
}

/**
 * Stacked bar chart, one bar per `teamId` (the lobby slot a summoner started
 * each match in — see `TeamSlotBreakdown`'s doc comment). Each bar stacks
 * 1st-place finishes, 2nd-3rd finishes, and everything lower, to show
 * whether any slot skews toward better or worse outcomes. Built on the same
 * `HextechBarChart` KDA uses (see `components/hextech-bar-chart.tsx`) rather
 * than nivo's `ResponsiveBar` — nivo drew this as an SVG stacked bar with an
 * `enableTotals` label and a custom axis tick for the team crest, but the
 * hand-rolled Hextech chart already has all three (a `topLabel`, a
 * multi-segment stack, and an icon strip) and keeps this section visually
 * consistent with every other bar chart in the app instead of looking like
 * a themed-but-still-generically-shaped charting-library default.
 */
const TeamSlot = ({ teamSlot }: Props) => {
  const { hover, onHover, containerRef: chartRef } = useChartHover<number>();

  const columns = buildTeamSlotColumns(teamSlot).map((column) => ({
    ...column,
    ariaLabel: `Team ${TEAM_NAME[Number(column.id)] ?? column.id}`,
  }));
  const hoveredRow = hover ? teamSlot.byTeamId.find((row) => row.teamId === hover.id) : undefined;


  return (
    <CategorySection
      title="TEAM SLOT"
      quote="We are all kin of kin. Blood, of blood."
      imageUrl={SECTION_BACKGROUNDS.teamSlot}
    >
      <HextechPanel>
        <div className="mb-3.5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            FINISHES BY TEAM SLOT
          </div>
        </div>

        <div className="flex min-h-0 flex-1 justify-center">
          <div ref={chartRef} className="flex h-full w-[70%] flex-col">
            <HextechBarChart
              columns={columns}
              center
              gap={48}
              columnWidth={108}
              heightUnit="percent"
              onHover={onHover}
              highlightedId={hover?.id ?? null}
            />
          </div>
          <CursorTooltip point={hoveredRow ? hover!.point : null}>
            {hoveredRow ? <TeamSlotCard row={hoveredRow} teamSlot={teamSlot} /> : null}
          </CursorTooltip>
        </div>
      </HextechPanel>
    </CategorySection>
  );
};

export { TeamSlot };
