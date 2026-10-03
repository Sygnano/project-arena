import type { AbilityCastBreakdown, ChampionAugmentStats, ChampionItemStats, DamageBreakdown } from "@arena/types";
import type { DonutSlice } from "@/features/recap/components/slides/champion-gallery/components/composition-donut";
import { ABILITY_COLORS, ABILITY_KEYS } from "@/features/recap/utils/ability-colors";
import { DAMAGE_TYPE_COLORS, DAMAGE_TYPE_KEYS, DAMAGE_TYPE_LABELS } from "@/features/recap/utils/damage-types";
import type { PickEntry } from "./types";

function percent(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function itemEntries(items: readonly ChampionItemStats[] | undefined): PickEntry[] {
  return (items ?? []).map((item) => ({
    id: item.itemId,
    name: item.itemName,
    iconUrl: item.iconUrl,
    games: item.count,
    wins: item.top3,
    firsts: item.top1,
  }));
}

function augmentEntries(augments: readonly ChampionAugmentStats[] | undefined, rarity: number): PickEntry[] {
  return (augments ?? [])
    .filter((augment) => augment.rarity === rarity)
    .map((augment) => ({
      id: augment.augmentId,
      name: augment.augmentName,
      iconUrl: augment.iconUrl,
      games: augment.timesPicked,
      wins: augment.top3,
      firsts: augment.top1,
    }));
}

function damageSlices(breakdown: DamageBreakdown): DonutSlice[] {
  return DAMAGE_TYPE_KEYS.map((key) => ({
    key,
    label: DAMAGE_TYPE_LABELS[key],
    value: breakdown[key],
    color: DAMAGE_TYPE_COLORS[key],
  }));
}

function castSlices(breakdown: AbilityCastBreakdown): DonutSlice[] {
  return ABILITY_KEYS.map((key) => ({
    key,
    label: key.toUpperCase(),
    value: breakdown[key],
    color: ABILITY_COLORS[key],
  }));
}

function sumCasts(breakdown: AbilityCastBreakdown): number {
  return breakdown.q + breakdown.w + breakdown.e + breakdown.r;
}

export { augmentEntries, castSlices, damageSlices, itemEntries, percent, sumCasts };
