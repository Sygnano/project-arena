// Same Data Dragon version pin as apps/web/src/lib/riot.ts and
// championData.ts — bump all three together.
const DDRAGON_VERSION = "16.17.1";

/**
 * Arena's "Prismatic Item" tier — the rarest end-game items, drawn from the
 * `220007` anvil (see CLAUDE.md §2). There is no field anywhere in Riot's
 * API, Data Dragon, or Community Dragon that flags an item as Prismatic;
 * this list was verified by cross-referencing the user's own knowledge
 * against Data Dragon's official item.json, confirming every id in the
 * 443000-447999 range (43xxx: various classes, 444xxx, 446xxx, 447xxx) is a
 * real, named item and that no id outside this range shares the pattern.
 * Update this list only after similarly verifying against real data — see
 * CLAUDE.md §2 for the dead ends already ruled out (raw match payload has
 * no rarity field at all; Data Dragon's own fields don't distinguish these
 * from Legendary items either).
 */
const PRISMATIC_ITEM_IDS: readonly number[] = [
  443054, 443055, 443056, 443058, 443059, 443060, 443061, 443062, 443063, 443064, 443069, 443079,
  443080, 443081, 443083, 443090, 443193, 444636, 444637, 444644, 446632, 446656, 446667, 446671,
  446691, 446693, 447100, 447101, 447102, 447103, 447104, 447105, 447106, 447107, 447108, 447109,
  447110, 447111, 447112, 447113, 447114, 447115, 447116, 447118, 447119, 447120, 447121, 447122,
  447123,
];

interface DataDragonItemList {
  data: Record<string, { name: string }>;
}

let prismaticItemsPromise: Promise<{ id: number; name: string }[]> | null = null;

async function fetchPrismaticItems(): Promise<{ id: number; name: string }[]> {
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/item.json`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Data Dragon item list: ${res.status}`);
  }
  const json = (await res.json()) as DataDragonItemList;
  return PRISMATIC_ITEM_IDS.map((id) => ({
    id,
    name: json.data[String(id)]?.name ?? `Item ${id}`,
  }));
}

/** Cached for the process's lifetime, memoized as a promise — same pattern
 * as championData.ts/augmentData.ts. */
function getPrismaticItems(): Promise<{ id: number; name: string }[]> {
  prismaticItemsPromise ??= fetchPrismaticItems();
  return prismaticItemsPromise;
}

function itemIconUrl(itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`;
}

export { getPrismaticItems, itemIconUrl };
