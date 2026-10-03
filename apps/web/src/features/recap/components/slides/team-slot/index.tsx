"use client";

import type { TeamSlotStats } from "@arena/types";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { FadingRule } from "@/components/fading-rule";
import { HextechBarChart } from "@/components/hextech-bar-chart";
import { HextechPanel } from "@/components/hextech-panel";
import { CategorySection } from "@/features/recap/components/category-section";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { TEAM_NAME } from "@/features/recap/utils/team-crests";
import { useChartHover } from "@/hooks/use-chart-hover";
import { TeamSlotCard } from "./components/team-slot-card";
import { buildTeamSlotColumns } from "./utils";

type Props = {
  teamSlot: TeamSlotStats;
};

/**
 * Stacked bar chart, one bar per `teamId` (the lobby slot a summoner started
 * each match in — see `TeamSlotBreakdown`'s doc comment). Each bar stacks
 * 1st-place finishes, 2nd-3rd finishes, and everything lower, to show
 * whether any slot skews toward better or worse outcomes. Built on the same
 * `HextechBarChart` KDA uses (see `@/components/hextech-bar-chart`) rather
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
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">FINISHES BY TEAM SLOT</div>
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
