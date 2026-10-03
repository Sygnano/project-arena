"use client";

import type { ChampionStats } from "@arena/types";
import {
  HoverCardChampions,
  HoverCardRows,
  HoverCardSection,
  HoverStatCard,
} from "@/features/recap/components/hover-stat-card";
import type { PlateTier } from "@/features/recap/components/slides/kills/types";
import { exactMultikills } from "./utils";

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

export { MultikillCard };
