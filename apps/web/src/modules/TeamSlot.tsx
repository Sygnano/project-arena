"use client";

import { ResponsiveBar } from "@nivo/bar";
import type { TeamSlotStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import {
  GoldGradientDef,
  goldGradientFill,
  PrismaticGradientDef,
  prismaticGradientFill,
  SilverGradientDef,
  silverGradientFill,
} from "@/components/augment-gradients";

type Props = {
  teamSlot: TeamSlotStats;
};

const PRISMATIC_GRADIENT_ID = "team-slot-prismatic-fill";
const GOLD_GRADIENT_ID = "team-slot-gold-fill";
const SILVER_GRADIENT_ID = "team-slot-silver-fill";

// Same augment-rarity mapping as PositionsChart/PositionsFunnel — 1st place
// gets the animated Prismatic fill, 2nd-3rd get static Gold, the rest get
// static Silver. Keyed by `bar.id` (the stack key, e.g. "1st") rather than
// `bar.data.order` since this chart's rows are per-team-slot, not per-placement.
function stackColor(bar: { id: string | number }): string {
  if (bar.id === "1st") return prismaticGradientFill(PRISMATIC_GRADIENT_ID);
  if (bar.id === "2nd-3rd") return goldGradientFill(GOLD_GRADIENT_ID);
  return silverGradientFill(SILVER_GRADIENT_ID);
}

// Arena's 8 lobby "teams" each have a jungle-camp crest (Poro, Wolf, Minion,
// Krug, Raptor, Scuttle, Sentinel, Gromp — see the match history client's own
// `subteams/*.svg` assets, linked below). Riot's Match-V5 API never sends
// this identity (only the bare numeric `playerSubteamId`), so it can't be
// verified against our own ingested data the way everything else in this
// codebase is — this mapping is taken on the user's own in-game knowledge,
// confirmed 1-6 only (the current 6-team format, see CLAUDE.md §2 on team
// size). 7/8 (Wolf/Gromp) are left out rather than guessed at an unconfirmed
// order, since teamId can't currently exceed 6 anyway.
const TEAM_ICON_SLUG: Record<string, string> = {
  "Team 1": "poro",
  "Team 2": "minion",
  "Team 3": "scuttle",
  "Team 4": "krug",
  "Team 5": "raptor",
  "Team 6": "sentinel",
};

function teamIconUrl(slug: string): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/images/subteams/${slug}.svg`;
}

const TEAM_ICON_SIZE = 60;

/** Custom x-axis tick: the team's crest instead of plain "Team N" text,
 * falling back to text for any teamId outside `TEAM_ICON_SLUG` (7/8, or a
 * future team-count change — see CLAUDE.md §2). Positions itself the same
 * way nivo's own default tick does (`AxisTick.tsx` in `@nivo/axes`) but
 * without pulling in `@react-spring/web` for the mount/update transition —
 * not worth the extra dependency for a fixed, rarely-reordered set of 6 ticks. */
function renderTeamAxisTick({
  value,
  x,
  y,
  textX,
  textY,
  lineX,
  lineY,
  opacity,
}: {
  value: string;
  x: number;
  y: number;
  textX: number;
  textY: number;
  lineX: number;
  lineY: number;
  opacity?: number;
}) {
  const slug = TEAM_ICON_SLUG[value];
  return (
    <g transform={`translate(${x},${y})`} style={{ opacity }}>
      <line
        x1={0}
        x2={lineX}
        y1={0}
        y2={lineY}
        stroke="var(--color-lol-border-muted)"
      />
      {slug ? (
        <image
          href={teamIconUrl(slug)}
          x={textX - TEAM_ICON_SIZE / 2}
          y={textY}
          width={TEAM_ICON_SIZE}
          height={TEAM_ICON_SIZE}
        >
          <title>{value}</title>
        </image>
      ) : (
        <text
          x={textX}
          y={textY}
          textAnchor="middle"
          dominantBaseline="hanging"
          fill="var(--color-lol-text-muted)"
          fontSize={12}
        >
          {value}
        </text>
      )}
    </g>
  );
}

/**
 * Stacked vertical bar chart, one bar per `teamId` (the lobby slot a
 * summoner started each match in — see `TeamSlotBreakdown`'s doc comment).
 * Each bar stacks 1st-place finishes, 2nd-3rd finishes, and everything
 * lower, to show whether any slot skews toward better or worse outcomes.
 */
const TeamSlot = ({ teamSlot }: Props) => {
  const chartData = teamSlot.byTeamId.map((row) => ({
    teamId: `Team ${row.teamId}`,
    "1st": row.top1,
    "2nd-3rd": row.top3ExclTop1,
    Remaining: row.remaining,
  }));

  return (
    <CategorySection
      title="Team Slot"
      quote="We are all kin of kin. Blood, of blood."
    >
      <div className="h-full w-[75%]">
        {/* See PositionsChart's own copy of this comment for why these need a
         * unique id per chart rather than a shared default. */}
        <PrismaticGradientDef id={PRISMATIC_GRADIENT_ID} />
        <GoldGradientDef id={GOLD_GRADIENT_ID} />
        <SilverGradientDef id={SILVER_GRADIENT_ID} />
        <ResponsiveBar
          enableTotals={true}
          data={chartData}
          // nivo stacks vertical bars bottom-up in `keys` order, so
          // "Remaining" (4th-6th) goes first/bottom and "1st" goes
          // last/top.
          keys={["Remaining", "2nd-3rd", "1st"]}
          indexBy="teamId"
          groupMode="stacked"
          margin={{ top: 40, right: 20, bottom: TEAM_ICON_SIZE + 25, left: 50 }}
          padding={0.4}
          colors={stackColor}
          axisLeft={null}
          borderRadius={2}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            renderTick: renderTeamAxisTick,
          }}
          enableGridY={false}
          theme={{
            text: { fill: "var(--color-lol-text-secondary)", fontSize: 12 },
            axis: {
              ticks: { text: { fill: "var(--color-lol-text-muted)" } },
              legend: { text: { fill: "var(--color-lol-text-secondary)" } },
            },
            grid: { line: { stroke: "var(--color-lol-border-muted)" } },
            tooltip: {
              container: {
                background: "var(--color-lol-navy-900)",
                color: "var(--color-lol-text)",
              },
            },
          }}
        />
      </div>
    </CategorySection>
  );
};

export { TeamSlot };
