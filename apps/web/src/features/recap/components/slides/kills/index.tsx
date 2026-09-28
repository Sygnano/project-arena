"use client";

import type { KillsStats, ChampionStats } from "@arena/types";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { useChartHover } from "@/hooks/use-chart-hover";
import { CategorySection } from "@/features/recap/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { RecordColumn } from "./components/record-column";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { MultikillCard } from "./components/multikill-card";
import { Plate } from "./components/plate";
import type { MultikillKey, PlateTier } from "./types";

type Props = KillsStats & {
  champions: Record<number, ChampionStats>;
};

/**
 * Multikills — the repo's three flat stat grids (Kills, Fun, and part of
 * Ability), given a hierarchy: multikills are the headline, tiered
 * Silver->Gold->Prismatic like every other ranked bar in the app, with
 * records dropping to a two-column footer (the fun counters moved to
 * `modules/Pings.tsx`'s "FOR THE RECORD" grid). This retires `modules/Fun.tsx`
 * as a standalone section — see design_handoff_arena_panels/README.md, 7d.
 */
const Kills = ({
  doubleKills,
  tripleKills,
  quadraKills,
  pentaKills,
  largestKillingSpree,
  champions,
  firstBloodKills,
  firstBloodAssists,
  soloKills,
  flawlessAces,
}: Props) => {
  // Riot's doubleKills/tripleKills/quadraKills/pentaKills are cumulative — a
  // Penta Kill increments all four counters, since getting one inherently
  // means passing through a double, triple, and quadra on the way there.
  // Subtracting the next tier up gives the count of streaks that stopped at
  // exactly that tier.
  // Clamped at 0: if an aggregate ever breaks the cumulative assumption, a
  // plate should read 0, not a negative count.
  const exactDouble = Math.max(0, doubleKills - tripleKills);
  const exactTriple = Math.max(0, tripleKills - quadraKills);
  const exactQuadra = Math.max(0, quadraKills - pentaKills);

  const { hover, onHover, containerRef } = useChartHover<MultikillKey>();
  const totalGames = Object.values(champions).reduce((sum, champion) => sum + champion.matchesPlayed, 0);
  const tiers: PlateTier[] = [
    {
      key: "double",
      label: "DOUBLE",
      count: exactDouble,
      borderColor: "rgba(185,196,200,.5)",
      boxShadow: "0 0 18px rgba(185,196,200,.14)",
      countColor: "#eef2f3",
      labelColor: "#a09b8c",
    },
    {
      key: "triple",
      label: "TRIPLE",
      count: exactTriple,
      borderColor: "rgba(185,196,200,.7)",
      boxShadow: "0 0 18px rgba(185,196,200,.22)",
      countColor: "#eef2f3",
      labelColor: "#a09b8c",
    },
    {
      key: "quadra",
      label: "QUADRA",
      count: exactQuadra,
      borderColor: "#c89b3c",
      boxShadow: "0 0 22px rgba(200,155,60,.3)",
      countColor: "#f0e6d2",
      labelColor: "var(--color-lol-gold-300)",
    },
    {
      key: "penta",
      label: "PENTA",
      count: pentaKills,
      borderColor: "#f5eaff",
      boxShadow: "0 0 30px rgba(185,138,221,.45)",
      countColor: "#f5eaff",
      labelColor: "#d8b6f0",
      prismatic: true,
    },
  ];
  const hoveredTier = hover ? tiers.find((tier) => tier.key === hover.id) : undefined;

  return (
    <CategorySection
      title="KILLS"
      quote="In carnage, I bloom, like a flower in the dawn."
      imageUrl={SECTION_BACKGROUNDS.kills}
    >
      <HextechPanel title="MULTIKILLS" bodyClassName="pt-14">
        <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-x-[clamp(48px,7vw,128px)] gap-y-16 py-6">
          <div ref={containerRef} className="contents">
            {tiers.map((tier) => (
              <Plate key={tier.key} tier={tier} onHover={onHover} />
            ))}
          </div>
          <CursorTooltip point={hoveredTier ? hover!.point : null}>
            {hoveredTier ? <MultikillCard tier={hoveredTier} champions={champions} totalGames={totalGames} /> : null}
          </CursorTooltip>
        </div>

        <div
          className="flex flex-wrap justify-center gap-y-6 pt-6"
          style={{ borderTop: "1px solid rgba(200,170,110,.28)" }}
        >
          <RecordColumn
            heading="ACE IN THE HOLE"
            headingColor="var(--color-lol-gold-300)"
            className="w-full sm:w-auto sm:min-w-sm sm:pr-10"
            rows={[
              ["FIRST BLOODS", firstBloodKills],
              ["FIRST BLOOD ASSISTS", firstBloodAssists],
              ["SOLO KILLS", soloKills],
            ]}
          />
          <RecordColumn
            heading="SPRAY AND PRAY"
            headingColor="var(--color-lol-gold-300)"
            className="w-full sm:w-auto sm:min-w-sm sm:pl-10"
            bordered
            rows={[
              ["LARGEST SPREE", largestKillingSpree],
              ["FLAWLESS ACES", flawlessAces],
            ]}
          />
        </div>
      </HextechPanel>
    </CategorySection>
  );
};

export { Kills };
