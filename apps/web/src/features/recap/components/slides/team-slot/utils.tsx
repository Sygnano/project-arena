import type { TeamSlotStats } from "@arena/types";
import type { BarColumn } from "@/components/hextech-bar-chart";
import { BAR_MAX_PERCENT, SEGMENT_TIER, TEAM_ICON_SLUG, TEAM_NAME } from "./constants";

function teamIconUrl(slug: string): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/images/subteams/${slug}.svg`;
}

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
  const totals = teamSlot.byTeamId.map((row) => row.top1 + row.top3ExclTop1 + row.remaining);
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
              <img loading="lazy" decoding="async" src={teamIconUrl(slug)} alt="" width={36} height={36} />
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

export { buildTeamSlotColumns };
