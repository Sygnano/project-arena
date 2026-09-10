import type { AbilityStats, ChampionStats } from "@arena/types";
import { ChampionBreakdownPanel } from "@/components/champion-breakdown-panel";

type Props = {
  ability: AbilityStats;
  champions: Record<number, ChampionStats>;
};

const CATEGORIES = [
  { key: "q", label: "Q", color: "var(--color-lol-blue-300)" },
  { key: "w", label: "W", color: "var(--color-lol-heal)" },
  { key: "e", label: "E", color: "var(--color-lol-gold-300)" },
  { key: "r", label: "R", color: "var(--color-lol-mythic)" },
] as const;

const Ability = ({ ability, champions }: Props) => (
  <ChampionBreakdownPanel
    categoryTitle="Ability Casts"
    totalLabel="Total Casts"
    maxGameLabel="Max Casts (1 Game)"
    categories={CATEGORIES}
    stats={ability}
    champions={Object.values(champions).map((champion) => ({
      championId: champion.championId,
      championName: champion.championName,
      total: champion.ability.total,
      maxGame: champion.ability.maxGame,
    }))}
    summaryStats={[{ label: "Skillshots Hit", value: ability.totalSkillshotsHit }]}
  />
);

export { Ability };
