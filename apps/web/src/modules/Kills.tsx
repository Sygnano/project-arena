import type { KillsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { StatGrid } from "@/components/stat-grid";
import { Separator } from "@/components/ui/separator";

type Props = KillsStats;

const VERTICAL_SEPARATOR_CLASS =
  "mx-12 bg-transparent bg-linear-to-b from-transparent via-lol-gold-400 to-transparent";

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
}: Props) => {
  // Riot's doubleKills/tripleKills/quadraKills/pentaKills are cumulative —
  // a Penta Kill increments all four counters, since getting one inherently
  // means you passed through a double, triple, and quadra on the way there.
  // Subtracting the next tier up gives the count of streaks that stopped at
  // exactly that tier (pentaKills itself needs no adjustment: Arena has no
  // tier above it).
  const exactDoubleKills = doubleKills - tripleKills;
  const exactTripleKills = tripleKills - quadraKills;
  const exactQuadraKills = quadraKills - pentaKills;

  return (
    <CategorySection title="Kills">
      <div className="flex w-full">
        <StatGrid
          className="flex-1"
          stats={[
            ["Double Kills", exactDoubleKills],
            ["Triple Kills", exactTripleKills],
            ["Quadra Kills", exactQuadraKills],
            ["Penta Kills", pentaKills],
          ]}
        />

        <Separator orientation="vertical" className={VERTICAL_SEPARATOR_CLASS} />

        <StatGrid
          className="flex-1"
          stats={[
            ["First Bloods", firstBloodKills],
            ["First Blood Assists", firstBloodAssists],
            ["Solo Kills", soloKills],
          ]}
        />

        <Separator orientation="vertical" className={VERTICAL_SEPARATOR_CLASS} />

        <StatGrid
          className="flex-1"
          stats={[
            ["Largest Killing Spree", largestKillingSpree],
            ["Flawless Aces", flawlessAces],
          ]}
        />
      </div>
    </CategorySection>
  );
};

export { Kills };
