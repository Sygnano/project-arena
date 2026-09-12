import type { TeamSlotStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import {
  HextechBarChart,
  type BarColumn,
} from "@/components/hextech-bar-chart";
import { FadingRule } from "@/components/fading-rule";

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

// 380 used to fit here (the chart alone had the panel's full height); now
// that a header row sits above it, the tallest column's topLabel needs this
// trimmed down or it collides with that header — 330 matches Positions'
// own BAR_MAX_HEIGHT, whose chart lives under the exact same header shape.
const BAR_MAX_HEIGHT = 330;

/**
 * Same three rarity tiers `HextechBarChart`'s KDA columns use for their top
 * 3 ranks, applied here by FIXED meaning instead of rank: every team's 1st
 * segment is Prismatic, 2nd-3rd is Gold, and the rest is Silver, regardless
 * of which team has the most of each. `borderColor`/`boxShadow` mirror
 * `KDA/index.tsx`'s `BAR_TIER` table exactly (same tokens, same reasoning
 * for why they're still needed alongside `fillClassName`).
 */
const SEGMENT_TIER = {
  top1: {
    fillClass: "tier-bar-prismatic",
    edge: "#f5eaff",
    glow: "0 0 20px rgba(185,138,221,.55)",
  },
  top3: {
    fillClass: "tier-bar-gold",
    edge: "var(--color-lol-gold-50)",
    glow: "0 0 20px rgba(200,155,60,.55)",
  },
  remaining: {
    fillClass: "tier-bar-silver",
    edge: "#eef2f3",
    glow: "0 0 16px rgba(185,196,200,.5)",
  },
} as const;

/**
 * Builds one stacked column per team slot — 1st-place finishes on top
 * (Prismatic), 2nd-3rd in the middle (Gold), everything else at the bottom
 * (Silver), tallest-total team setting the scale for all six so their
 * relative sizes stay comparable. Each segment gets an in-bar value label
 * (dropped by `HextechBarChart` itself when the segment's too short to fit
 * one legibly) AND a `title` tooltip carrying the same number, so the exact
 * value is still reachable on hover even for a sliver-thin segment — see
 * the module doc comment for why both exist rather than picking one.
 */
function buildTeamSlotColumns(teamSlot: TeamSlotStats): BarColumn[] {
  const totals = teamSlot.byTeamId.map(
    (row) => row.top1 + row.top3ExclTop1 + row.remaining,
  );
  const maxTotal = Math.max(1, ...totals);
  const scale = BAR_MAX_HEIGHT / maxTotal;

  return teamSlot.byTeamId.map((row) => {
    const total = row.top1 + row.top3ExclTop1 + row.remaining;
    const slug = TEAM_ICON_SLUG[row.teamId];

    const segments = (
      [
        ["1st", row.top1, SEGMENT_TIER.top1, "1st-place finish"],
        [
          "2nd-3rd",
          row.top3ExclTop1,
          SEGMENT_TIER.top3,
          "2nd-3rd place finish",
        ],
        ["remaining", row.remaining, SEGMENT_TIER.remaining, "lower finish"],
      ] as const
    )
      .map(([key, value, tier, noun]) => ({
        key,
        value,
        height: Math.round(value * scale),
        label: value > 0 ? String(value) : undefined,
        title: `${value} ${noun}${value === 1 ? "" : "es"}`,
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
              boxShadow: "rgba(10,200,185,.75)",
              background: "rgba(5,14,22,.75)",
            }}
          >
            <div className="font-display -rotate-45 text-[15px] tracking-[.04em] text-lol-gold-50">
              <img
                src={teamIconUrl(slug)}
                alt={`Team ${row.teamId}`}
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
  const columns = buildTeamSlotColumns(teamSlot);

  return (
    <CategorySection
      title="TEAM"
      quote="We are all kin of kin. Blood, of blood."
      imageUrl="/images/kda-bg.jpg"
    >
      <HextechPanel>
        <div className="mb-3.5 flex items-center gap-6">
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            FINISHES BY TEAM SLOT
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-[70%]">
            <HextechBarChart
              columns={columns}
              center
              gap={48}
              columnWidth={108}
            />
          </div>
        </div>
      </HextechPanel>
    </CategorySection>
  );
};

export { TeamSlot };
