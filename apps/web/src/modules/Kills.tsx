import type { KillsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { RecordColumn } from "@/components/record-column";

type Props = KillsStats & {
  totalSkillshotsHit: number;
  nextSectionLabel?: string;
};

type PlateTier = {
  label: string;
  count: number;
  borderColor: string;
  boxShadow: string;
  countColor: string;
  labelColor: string;
  prismatic?: boolean;
};

function Plate({ tier }: { tier: PlateTier }) {
  return (
    <div className="flex flex-col items-center gap-5.5">
      <div
        className="relative flex h-31.5 w-31.5 rotate-45 items-center justify-center border"
        style={{
          borderColor: tier.borderColor,
          background: "rgba(5,14,22,.55)",
          boxShadow: tier.boxShadow,
        }}
      >
        {tier.prismatic ? (
          <div className="tier-bar-prismatic absolute inset-1.25 opacity-[.16]" />
        ) : null}
        <div
          className="font-display relative text-[42px] -rotate-45"
          style={{ color: tier.countColor }}
        >
          {tier.count}
        </div>
      </div>
      <div
        className="pl-[.28em] text-[11px] tracking-[.28em] mt-5"
        style={{ color: tier.labelColor }}
      >
        {tier.label}
      </div>
    </div>
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
  firstBloodKills,
  firstBloodAssists,
  soloKills,
  flawlessAces,
  totalSkillshotsHit,
  nextSectionLabel = "PICKS",
}: Props) => {
  // Riot's doubleKills/tripleKills/quadraKills/pentaKills are cumulative — a
  // Penta Kill increments all four counters, since getting one inherently
  // means passing through a double, triple, and quadra on the way there.
  // Subtracting the next tier up gives the count of streaks that stopped at
  // exactly that tier.
  const exactDouble = doubleKills - tripleKills;
  const exactTriple = tripleKills - quadraKills;
  const exactQuadra = quadraKills - pentaKills;

  return (
    <CategorySection
      title="KILLS"
      quote="In carnage, I bloom, like a flower in the dawn."
      imageUrl="/images/kda-bg.jpg"
      nextSectionLabel={nextSectionLabel}
    >
      <HextechPanel title="MULTIKILLS" bodyClassName="pt-14">
        <div className="flex min-h-0 flex-1 items-center justify-center gap-32">
          <Plate
            tier={{
              label: "DOUBLE",
              count: exactDouble,
              borderColor: "rgba(185,196,200,.5)",
              boxShadow: "0 0 18px rgba(185,196,200,.14)",
              countColor: "#eef2f3",
              labelColor: "#a09b8c",
            }}
          />
          <Plate
            tier={{
              label: "TRIPLE",
              count: exactTriple,
              borderColor: "rgba(185,196,200,.7)",
              boxShadow: "0 0 18px rgba(185,196,200,.22)",
              countColor: "#eef2f3",
              labelColor: "#a09b8c",
            }}
          />
          <Plate
            tier={{
              label: "QUADRA",
              count: exactQuadra,
              borderColor: "#c89b3c",
              boxShadow: "0 0 22px rgba(200,155,60,.3)",
              countColor: "#f0e6d2",
              labelColor: "var(--color-lol-gold-300)",
            }}
          />
          <Plate
            tier={{
              label: "PENTA",
              count: pentaKills,
              borderColor: "#f5eaff",
              boxShadow: "0 0 30px rgba(185,138,221,.45)",
              countColor: "#f5eaff",
              labelColor: "#d8b6f0",
              prismatic: true,
            }}
          />
        </div>

        <div
          className="flex justify-center pt-6"
          style={{ borderTop: "1px solid rgba(200,170,110,.28)" }}
        >
          <RecordColumn
            heading="ACE IN THE HOLE"
            headingColor="var(--color-lol-gold-300)"
            className="pr-10 min-w-sm"
            rows={[
              ["FIRST BLOODS", firstBloodKills],
              ["FIRST BLOOD ASSISTS", firstBloodAssists],
              ["SOLO KILLS", soloKills],
            ]}
          />
          <RecordColumn
            heading="SPRAY AND PRAY"
            headingColor="var(--color-lol-gold-300)"
            className="pl-10 min-w-sm"
            bordered
            rows={[
              ["LARGEST SPREE", largestKillingSpree],
              ["FLAWLESS ACES", flawlessAces],
              ["SKILLSHOTS HIT", totalSkillshotsHit],
            ]}
          />
        </div>
      </HextechPanel>
    </CategorySection>
  );
};

export { Kills };
