import type { ChampionStats, DamageStats } from "@arena/types";
import { ChampionBreakdownPanel } from "@/components/champion-breakdown-panel";

type Props = {
  damage: DamageStats;
  champions: Record<number, ChampionStats>;
};

const CATEGORIES = [
  { key: "physical", label: "Physical", color: "var(--color-lol-damage)" },
  { key: "magical", label: "Magical", color: "var(--color-lol-blue-300)" },
  { key: "trueDamage", label: "True", color: "var(--color-lol-gold-300)" },
] as const;

const Damage = ({ damage, champions }: Props) => (
  <ChampionBreakdownPanel
    categoryTitle="Damage"
    totalLabel="Total Damage"
    maxGameLabel="Max Damage (1 Game)"
    categories={CATEGORIES}
    stats={damage}
    champions={Object.values(champions).map((champion) => ({
      championId: champion.championId,
      championName: champion.championName,
      total: champion.damage.total,
      maxGame: champion.damage.maxGame,
    }))}
  />
);

export { Damage };
