/**
 * The raw CommunityDragon files this folder reads, trimmed to the fields we
 * use. The real payloads carry many more.
 */

/** `v1/champion-summary.json`. Also lists `-1` "None" and mode-only variants (`Jade_Annie`, ids 60000+). */
export interface CDragonChampion {
  id: number;
  /** Riot's champion key: `"MonkeyKing"`, `"FiddleSticks"`. Same string, same
   * casing, as Match-V5's `championName`. */
  alias: string;
  /** Display name: `"Wukong"`. */
  name: string;
}

/** `v1/items.json`. */
export interface CDragonItem {
  id: number;
  /** `"Item_226660_Name"` for an item with no localized name. */
  name: string;
  /** What one purchase costs, build path included. */
  priceTotal: number;
  /** Data Dragon's `tags`: `"Trinket"`, `"Consumable"`, `"Boots"`, ... */
  categories: string[];
  /** `/lol-game-data/assets/ASSETS/Items/Icons2D/7106_DragonHeart.png`. */
  iconPath: string;
}

/** `v1/summoner-spells.json`. */
export interface CDragonSummonerSpell {
  id: number;
  name: string;
  /** `/lol-game-data/assets/DATA/Spells/Icons2D/Summoner_flash.png`. */
  iconPath: string;
}

/** `cdragon/arena/en_us.json`: Arena augments (not in Data Dragon at all). */
export interface CDragonArenaData {
  augments: CDragonAugment[];
}

export interface CDragonAugment {
  /** What Match-V5's `playerAugment1`-`6` carry. */
  id: number;
  /** Riot's internal name: `"Dashing"`, `"GoHPowerCraving"`, `"CraftingAugmentSlot"`. */
  apiName: string;
  name: string;
  /** 0 Silver, 1 Gold, 2 Prismatic, 4 internal/meta (no 3). */
  rarity: number;
  /** Game asset path: `assets/ux/cherry/augments/icons/dashing_large.png`. */
  iconLarge: string;
}
