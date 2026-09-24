"use client";

import type { ChampionStats, KillsStats } from "@arena/types";
import { CursorTooltip } from "@/components/cursor-tooltip";
import type { HoverPoint } from "@/components/hextech-bar-chart";
import { HoverCardChampions, HoverCardRows, HoverCardSection, HoverStatCard } from "@/components/hover-stat-card";
import { useChartHover } from "@/hooks/use-chart-hover";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { RecordColumn } from "@/components/record-column";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = KillsStats & {
  champions: Record<number, ChampionStats>;
};

type MultikillKey = "double" | "triple" | "quadra" | "penta";

type PlateTier = {
  key: MultikillKey;
  label: string;
  count: number;
  borderColor: string;
  boxShadow: string;
  countColor: string;
  labelColor: string;
  prismatic?: boolean;
};

/** Streaks that stopped at exactly this tier for one champion — Riot's
 * per-champion counters are cumulative like the page-wide ones (a penta also
 * counts as a quadra, triple and double), so the next tier up is subtracted. */
function exactMultikills(champion: ChampionStats, key: MultikillKey): number {
  const { doubleKills, tripleKills, quadraKills, pentaKills } = champion.combat;
  const exact = {
    double: doubleKills - tripleKills,
    triple: tripleKills - quadraKills,
    quadra: quadraKills - pentaKills,
    penta: pentaKills,
  }[key];
  return Math.max(0, exact);
}

function Plate({ tier, onHover }: { tier: PlateTier; onHover: (id: MultikillKey | null, point?: HoverPoint) => void }) {
  return (
    <div
      tabIndex={0}
      aria-label={`${tier.count} ${tier.label.toLowerCase()} kills`}
      onPointerEnter={(event) => onHover(tier.key, { x: event.clientX, y: event.clientY })}
      onPointerMove={(event) => onHover(tier.key, { x: event.clientX, y: event.clientY })}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") onHover(null);
      }}
      onFocus={(event) => {
        // Keyboard focus only; a click keeps the card on the pointer.
        if (!event.currentTarget.matches(":focus-visible")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onHover(tier.key, { x: rect.left + rect.width / 2, y: rect.top });
      }}
      onBlur={() => onHover(null)}
      className="flex flex-col items-center gap-5.5 rounded-sm outline-none transition-[filter] duration-150 hover:brightness-125 focus-visible:brightness-125"
    >
      <div
        className="relative flex h-31.5 w-31.5 rotate-45 items-center justify-center border"
        style={{
          borderColor: tier.borderColor,
          background: "rgba(5,14,22,.55)",
          boxShadow: tier.boxShadow,
        }}
      >
        {tier.prismatic ? <div className="tier-bar-prismatic absolute inset-1.25 opacity-[.16]" /> : null}
        <div className="font-display relative text-[42px] -rotate-45" style={{ color: tier.countColor }}>
          {tier.count}
        </div>
      </div>
      <div className="pl-[.28em] text-[11px] tracking-[.28em] mt-5" style={{ color: tier.labelColor }}>
        {tier.label}
      </div>
    </div>
  );
}

/** Hover card for a multikill plate: which champions scored them. */
function MultikillCard({
  tier,
  champions,
  totalGames,
}: {
  tier: PlateTier;
  champions: Record<number, ChampionStats>;
  totalGames: number;
}) {
  const byChampion = Object.values(champions)
    .map((champion) => ({
      championName: champion.championName,
      games: exactMultikills(champion, tier.key),
    }))
    .filter((row) => row.games > 0)
    .sort((a, b) => b.games - a.games || a.championName.localeCompare(b.championName));
  const everyGames = tier.count > 0 ? totalGames / tier.count : null;

  return (
    <HoverStatCard
      title={`${tier.label} KILLS`}
      meta={tier.count.toLocaleString()}
      subtitle={
        everyGames === null
          ? "None yet"
          : `About one every ${everyGames < 10 ? everyGames.toFixed(1) : Math.round(everyGames)} games`
      }
      edgeColor={tier.borderColor}
    >
      {byChampion.length > 0 ? (
        <>
          <HoverCardSection label="MOST ON">
            <HoverCardChampions champions={byChampion.slice(0, 3)} noun="kill" />
          </HoverCardSection>
          {byChampion.length > 3 ? (
            <HoverCardSection>
              <HoverCardRows
                rows={[
                  {
                    label: "CHAMPIONS",
                    value: `${byChampion.length} with at least one`,
                  },
                ]}
              />
            </HoverCardSection>
          ) : null}
        </>
      ) : null}
    </HoverStatCard>
  );
}

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
