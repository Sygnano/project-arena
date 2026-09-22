import { ARENA_BOOT_ITEM_IDS } from "@arena/db";
import { fetchItems } from "../communityDragon/fetch.js";
import type { CDragonItem } from "../communityDragon/types.js";
import { gameDataAssetUrl } from "../communityDragon/urls.js";
import { memoizeAsync } from "../memoize.js";
import {
  ANVIL_AND_VOUCHER_ITEM_IDS,
  LEGENDARY_MIN_GOLD,
  PRISMATIC_ITEM_IDS,
  SHARDBLADE_ITEM_ID,
  SPECIAL_ITEM_IDS,
} from "./itemIds.js";

export interface Item {
  id: number;
  /** `Item <id>` when the item has no name. */
  name: string;
  /** Gold for one purchase. For Arena's one-step boots, the price paid. */
  goldTotal: number;
  /** "" when the item isn't in the data. */
  iconUrl: string;
  /** False for an unnamed placeholder, or an id missing from the data. */
  named: boolean;
  isTrinket: boolean;
  isConsumable: boolean;
}

/** CommunityDragon's name for an item with no localized name. */
const UNNAMED_ITEM = /^Item_\d+_Name$/;

function toItem(raw: CDragonItem): Item {
  const named = raw.name !== "" && !UNNAMED_ITEM.test(raw.name);
  return {
    id: raw.id,
    name: named ? raw.name : `Item ${raw.id}`,
    goldTotal: raw.priceTotal,
    iconUrl: raw.iconPath ? gameDataAssetUrl(raw.iconPath) : "",
    named,
    isTrinket: raw.categories.includes("Trinket"),
    isConsumable: raw.categories.includes("Consumable"),
  };
}

function placeholderItem(id: number): Item {
  return { id, name: `Item ${id}`, goldTotal: 0, iconUrl: "", named: false, isTrinket: false, isConsumable: false };
}

function isAnvilOrVoucher(id: number) {
  return id >= ANVIL_AND_VOUCHER_ITEM_IDS.first && id <= ANVIL_AND_VOUCHER_ITEM_IDS.last;
}

const prismaticIds = new Set(PRISMATIC_ITEM_IDS);
const specialIds = new Set(SPECIAL_ITEM_IDS);
const bootIds = new Set(ARENA_BOOT_ITEM_IDS);

/** Every item, plus Arena's classification rules. All lookups are synchronous,
 * so a stats scan filters thousands of rows without awaiting per item. */
export class ItemCatalog {
  constructor(private readonly byId: Map<number, Item>) {}

  all(): Item[] {
    return [...this.byId.values()];
  }

  /** Always returns an item: a placeholder for an id missing from the data. */
  get(id: number): Item {
    return this.byId.get(id) ?? placeholderItem(id);
  }

  /**
   * Whether an item is a Legendary: priced like one and none of the other
   * kinds sharing that price band (Prismatics, anvils/vouchers, Shardblade,
   * special items, boots, consumables, trinkets). On every item the tracked
   * summoners bought or held, this leaves exactly the 2500g build items.
   */
  isLegendary(id: number) {
    const item = this.get(id);
    return (
      item.named &&
      item.goldTotal >= LEGENDARY_MIN_GOLD &&
      !isAnvilOrVoucher(id) &&
      id !== SHARDBLADE_ITEM_ID &&
      !prismaticIds.has(id) &&
      !specialIds.has(id) &&
      !bootIds.has(id) &&
      !item.isTrinket &&
      !item.isConsumable
    );
  }

  /** Arena's Prismatic Items, in `PRISMATIC_ITEM_IDS` order. */
  prismaticItems(): Item[] {
    return PRISMATIC_ITEM_IDS.map((id) => this.get(id));
  }

  /** Arena's 8 boots, in `ARENA_BOOT_ITEM_IDS` order. */
  arenaBoots(): Item[] {
    return ARENA_BOOT_ITEM_IDS.map((id) => this.get(id));
  }
}

export const getItemCatalog = memoizeAsync(async () => {
  const items = await fetchItems();
  return new ItemCatalog(new Map(items.map((raw) => [raw.id, toItem(raw)])));
});
