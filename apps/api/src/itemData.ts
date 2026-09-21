import { ARENA_BOOT_ITEM_IDS } from "@arena/db";

// Same Data Dragon version pin as apps/web/src/lib/riot.ts and
// championData.ts — bump all three together.
const DDRAGON_VERSION = "16.17.1";

/**
 * Arena's "Prismatic Item" tier — the rarest end-game items, drawn from the
 * `220007` anvil (see CLAUDE.md §2). There is no field anywhere in Riot's
 * API, Data Dragon, or Community Dragon that flags an item as Prismatic;
 * the list is Data Dragon's items sold in Arena (`maps["30"]`) at exactly
 * 2750g, checked against every tracked match (each is held, and bought far
 * less often than held, since the anvil grants it). The id range is NOT the
 * rule: Goredrinker and Prowler's Claw are `22xxxx`, `443080` Twin Mask and
 * `446693` (a stale Prowler's Claw) aren't in Arena, and `447111` Overlord's
 * Bloodmail is a 2500g Legendary. See CLAUDE.md §2 for the dead ends
 * already ruled out.
 */
const PRISMATIC_ITEM_IDS: readonly number[] = [
  226630, 226693, 443054, 443055, 443056, 443058, 443059, 443060, 443061, 443062, 443063, 443064,
  443069, 443079, 443081, 443083, 443090, 443193, 444636, 444637, 444644, 446632, 446656, 446667,
  446671, 446691, 447100, 447101, 447102, 447103, 447104, 447105, 447106, 447107, 447108, 447109,
  447110, 447112, 447113, 447114, 447115, 447116, 447118, 447119, 447120, 447121, 447122, 447123,
];

interface DataDragonItemList {
  data: Record<string, { name: string; tags?: string[]; gold?: { total?: number } }>;
}

interface ItemCatalog {
  namesById: Map<number, string>;
  /** Item id -> total purchase cost, for gold-spent stats (see `getArenaBoots`). */
  goldById: Map<number, number>;
  /** Every item Data Dragon tags as a `Trinket` — see `isBuildItem`. */
  trinketIds: Set<number>;
  /** Every item Data Dragon tags as a `Consumable` (juices, anvils). */
  consumableIds: Set<number>;
}

let itemCatalogPromise: Promise<ItemCatalog> | null = null;

async function fetchItemCatalog(): Promise<ItemCatalog> {
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/item.json`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Data Dragon item list: ${res.status}`);
  }
  const json = (await res.json()) as DataDragonItemList;
  const namesById = new Map<number, string>();
  const goldById = new Map<number, number>();
  const trinketIds = new Set<number>();
  const consumableIds = new Set<number>();
  for (const [id, item] of Object.entries(json.data)) {
    namesById.set(Number(id), item.name);
    if (item.gold?.total !== undefined) goldById.set(Number(id), item.gold.total);
    if (item.tags?.includes("Trinket")) trinketIds.add(Number(id));
    if (item.tags?.includes("Consumable")) consumableIds.add(Number(id));
  }
  return { namesById, goldById, trinketIds, consumableIds };
}

/**
 * Data Dragon's item list, cached for the process's lifetime and memoized as
 * a promise — same pattern as championData.ts/augmentData.ts. One fetch backs
 * every item lookup the API does: `getItemNamesById`, `getPrismaticItems` and
 * `isBuildItem` are all projections of this, not separate requests.
 */
function getItemCatalog(): Promise<ItemCatalog> {
  itemCatalogPromise ??= fetchItemCatalog();
  return itemCatalogPromise;
}

/**
 * Every item id -> display name. The full map rather than just
 * `PRISMATIC_ITEM_IDS`' slice of it, since the per-champion "most-held items"
 * stat names ordinary Legendary/Boots items too, not only Prismatics.
 */
async function getItemNamesById(): Promise<Map<number, string>> {
  return (await getItemCatalog()).namesById;
}

/**
 * Arena's 8 boots, named and priced from Data Dragon. The id list itself
 * lives in `@arena/db`'s parseMatch (which needs it synchronously, with no
 * network access, to read boot purchases out of a timeline) — this only
 * decorates it with display data. Every Arena boot is a flat one-step
 * purchase, so `goldCost` is the real price paid, not a build-path total.
 */
async function getArenaBoots(): Promise<{ id: number; name: string; goldCost: number }[]> {
  const { namesById, goldById } = await getItemCatalog();
  return ARENA_BOOT_ITEM_IDS.map((id) => ({
    id,
    name: namesById.get(id) ?? `Item ${id}`,
    goldCost: goldById.get(id) ?? 0,
  }));
}

async function getPrismaticItems(): Promise<{ id: number; name: string }[]> {
  const { namesById } = await getItemCatalog();
  return PRISMATIC_ITEM_IDS.map((id) => ({
    id,
    name: namesById.get(id) ?? `Item ${id}`,
  }));
}

/**
 * A predicate for "is this end-of-match inventory slot something the player
 * actually built", with the catalog resolved up front so callers can filter a
 * whole scan synchronously instead of awaiting per item.
 * Filters out two things:
 *
 * - **Trinkets** (Data Dragon's own `Trinket` tag). Arena issues every player
 *   the same free trinket (`3348`, "Arcane Sweeper") and it never leaves the
 *   inventory, so without this it is by definition the #1 "most-held item" for
 *   every champion — confirmed against real data: it led the list for all 60
 *   champions the tracked summoner has played, held in 100% of their games.
 *   Read off the tag rather than hardcoding `3348` so a patch that swaps
 *   Arena's trinket doesn't silently reintroduce the problem.
 * - **Anvils and their vouchers** (`220000`-`220011`, see CLAUDE.md §2) — a
 *   shop mechanic rather than a build. They already have their own dedicated
 *   per-champion counters (`ChampionEconomyStats`).
 */
async function getBuildItemFilter(): Promise<(itemId: number) => boolean> {
  const { trinketIds } = await getItemCatalog();
  return (itemId) =>
    itemId !== 0 &&
    !(itemId >= 220000 && itemId <= 220011) &&
    !trinketIds.has(itemId);
}

/**
 * Arena's "Shardblade" (`220012`, "Increase the effectiveness of stat
 * shards") — granted by the game rather than bought, so it never shows up as
 * an ITEM_PURCHASED timeline event; the only trace it leaves is the
 * end-of-match inventory (`match_participants.items`). Not a Prismatic Item
 * and not in `PRISMATIC_ITEM_IDS`.
 */
const SHARDBLADE_ITEM_ID = 220012;

/**
 * Arena's "special" items, shown on their own page: The Golden Spatula,
 * Wooglet's Witchcap and Void Immolation. Like the Shardblade, none of them
 * is ever bought — checked against every tracked timeline: zero
 * ITEM_PURCHASED events. They're upgrades the game swaps in (Void
 * Immolation replaces a destroyed Sunfire Aegis / Hollow Radiance, Wooglet's
 * replaces Rabadon's Deathcap), so end-of-match `items` is the only source.
 */
const SPECIAL_ITEM_IDS: readonly number[] = [224403, 228002, 223069];

/** Price at or above which an ordinary Arena item counts as Legendary —
 * every Legendary on the current patch is 2500g (Prismatics 2750g, the
 * specials 6000g), while boots/components are 500g. */
const LEGENDARY_MIN_GOLD = 2000;

/**
 * Predicate for "is this a Legendary item": priced like one, and not any
 * of the other categories that share that price band — Prismatic Items,
 * anvils/vouchers/Shardblade (`220000`-`220012`), the special items,
 * boots, consumables or trinkets. Verified against every item the tracked
 * summoner bought or held: this leaves exactly the 2500g build items.
 */
async function getLegendaryItemFilter(): Promise<(itemId: number) => boolean> {
  const { namesById, goldById, trinketIds, consumableIds } = await getItemCatalog();
  const prismatic = new Set(PRISMATIC_ITEM_IDS);
  const special = new Set(SPECIAL_ITEM_IDS);
  const boots = new Set(ARENA_BOOT_ITEM_IDS);
  return (itemId) =>
    (goldById.get(itemId) ?? 0) >= LEGENDARY_MIN_GOLD &&
    !!namesById.get(itemId) &&
    !(itemId >= 220000 && itemId <= 220012) &&
    !prismatic.has(itemId) &&
    !special.has(itemId) &&
    !boots.has(itemId) &&
    !trinketIds.has(itemId) &&
    !consumableIds.has(itemId);
}

/** Total gold one purchase of `itemId` costs, from Data Dragon. */
async function getItemGoldById(): Promise<Map<number, number>> {
  return (await getItemCatalog()).goldById;
}

function itemIconUrl(itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`;
}

export {
  getArenaBoots,
  getBuildItemFilter,
  getItemNamesById,
  getPrismaticItems,
  getItemGoldById,
  getLegendaryItemFilter,
  itemIconUrl,
  SHARDBLADE_ITEM_ID,
  SPECIAL_ITEM_IDS,
};
