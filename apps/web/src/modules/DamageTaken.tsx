import type { ChampionStats, DamageStats } from "@arena/types";
import { ChampionBreakdownPanel } from "@/components/champion-breakdown-panel";

type Props = {
  damageTaken: DamageStats;
  champions: Record<number, ChampionStats>;
};

const CATEGORIES = [
  { key: "physical", label: "Physical", color: "var(--color-lol-damage)" },
  { key: "magical", label: "Magical", color: "var(--color-lol-blue-300)" },
  { key: "trueDamage", label: "True", color: "var(--color-lol-gold-300)" },
] as const;

const DamageTaken = ({ damageTaken, champions }: Props) => (
  <ChampionBreakdownPanel
    categoryTitle="Damage Taken"
    totalLabel="Total Damage Taken"
    maxGameLabel="Max Damage Taken (1 Game)"
    categories={CATEGORIES}
    stats={damageTaken}
    champions={Object.values(champions).map((champion) => ({
      championId: champion.championId,
      championName: champion.championName,
      total: champion.damageTaken.total,
      maxGame: champion.damageTaken.maxGame,
    }))}
  />
);

export { DamageTaken };
