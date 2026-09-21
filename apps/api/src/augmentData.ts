// Arena augment data isn't published on Data Dragon at all — Community
// Dragon's dedicated Arena endpoint is the only source (see CLAUDE.md §2).
// `latest` tracks the current patch automatically.
const AUGMENTS_URL = "https://raw.communitydragon.org/latest/cdragon/arena/en_us.json";

interface CommunityDragonAugment {
  id: number;
  apiName: string;
  name: string;
  desc: string;
  rarity: number;
  iconLarge: string;
}

interface CommunityDragonArenaData {
  augments: CommunityDragonAugment[];
}

// `apiName` prefixes for augments that aren't part of the normal in-game
// offer pool: "GoH*" (Tahm Kench's sacrifice-altar augment set from the
// Gift of Hunger event mechanic) and "Crafting*" (Arena's augment-crafting
// mechanic — see `META_AUGMENT_API_NAMES` below — a subset of the
// `rarity: 4` group documented in @arena/types' AugmentStats). Identified by
// the user cross-checking the full 225-augment catalog against real match
// data. Only the "GoH" prefix is actually confirmed absent from real picks
// (a champion-granted line, never a normal draft choice); the "Crafting"
// prefix (plus `GainStatAnvil`/`ReplaceAugment` below) genuinely IS picked in
// real match data (verified directly against `match_participants.augments`,
// e.g. `CraftingPrisStatAnvil` alone appears in ~1,100 of ~6,000 tracked
// participant rows) — it's excluded from the normal catalog/picks panels for
// the same reason as GoH (not part of the normal 3-augment offer pool, a
// separate crafting-menu choice instead), not because it's unplayed. Both
// groups are filtered out of the normal catalog/picks panels and surfaced
// with their own real treatment instead — GoH via `getGuestOfHonorAugmentDetails`/
// `GuestOfHonor.tsx`, Crafting via `getMetaAugments`/`MetaAugments.tsx` — so
// the exclusion is visible and reversible rather than silently dropped.
const EXCLUDED_API_NAME_PREFIXES = ["GoH", "Crafting"];

// A handful of standalone meta/internal `apiName`s that don't share either
// prefix above but are the same kind of "not a normal draftable augment"
// entry: `ReplaceAugment`/`GainStatAnvil` are two more of the augment-crafting
// choices (see `META_AUGMENT_API_NAMES` below), while `NullAugment` is a
// tooltip-only `desc: "Null"` placeholder with no real use — excluded from
// the normal catalog and left out of every other treatment too (unlike the
// other two, it has nothing to show).
const EXCLUDED_API_NAMES = new Set([
  "ReplaceAugment",
  "NullAugment",
  "GainStatAnvil",
]);

function isRemovedAugment(apiName: string): boolean {
  return (
    EXCLUDED_API_NAME_PREFIXES.some((prefix) => apiName.startsWith(prefix)) ||
    EXCLUDED_API_NAMES.has(apiName)
  );
}

/**
 * The "Guest of Honor" (GoH) subset of the removed-augment pile that's
 * actually a real, structured mechanic rather than filler: 4 champions
 * (Tahm Kench, Vayne, Kindred, Yone) each grant a teammate a champion-unique
 * augment line instead of a normal draft pick, and Riot's own internal
 * `apiName`s for all of them share the "GoH" prefix (see
 * `EXCLUDED_API_NAME_PREFIXES` above) regardless of which champion they
 * belong to. IDs verified against a real download of the Community Dragon
 * catalog (2026-09): every one of these is `apiName`-prefixed "GoH" and
 * `rarity: 4` (never a normal Silver/Gold/Prismatic offer).
 *
 * Tahm Kench's own set is the one actually named "Guest of Honor" in-game —
 * 3 independent tracks (Power/Risk/Wealth), each a 3-step chain: "Craving"
 * (the initial offer), "Compulsion" (escalating further), "Abstain" (opting
 * out and healing back the sacrificed health). Deliberately excludes the
 * "Sacrifice: For {Silver,Gold,Prismatic}" trio (ids 302/303/304) — those are
 * the one-time rarity-tier choice made when a teammate first becomes a Guest
 * of Honor, a different decision point from the Power/Risk/Wealth tracks
 * this screen shows.
 */
const GUEST_OF_HONOR_CHAMPIONS = [
  {
    championId: 223,
    championName: "Tahm Kench",
    rows: [
      { key: "power", label: "POWER", augmentIds: [369, 372, 366] },
      { key: "risk", label: "RISK", augmentIds: [370, 373, 367] },
      { key: "wealth", label: "WEALTH", augmentIds: [368, 371, 365] },
    ],
  },
  {
    championId: 67,
    championName: "Vayne",
    rows: [
      {
        key: "items",
        label: "ITEMS",
        augmentIds: [348, 347, 349, 350, 351, 354, 392],
      },
    ],
  },
  {
    championId: 203,
    championName: "Kindred",
    rows: [{ key: "spirits", label: "SPIRITS", augmentIds: [359, 358] }],
  },
  {
    championId: 777,
    championName: "Yone",
    rows: [{ key: "allegiance", label: "ALLEGIANCE", augmentIds: [361, 362] }],
  },
] as const;

/** Every augment id referenced anywhere in `GUEST_OF_HONOR_CHAMPIONS`, so
 * `getGuestOfHonorAugmentDetails` only needs to look up exactly these. */
const GUEST_OF_HONOR_AUGMENT_IDS = new Set(
  GUEST_OF_HONOR_CHAMPIONS.flatMap((champion) =>
    champion.rows.flatMap((row) => row.augmentIds as readonly number[]),
  ),
);

/**
 * The "Crafting"-prefixed/`GainStatAnvil`/`ReplaceAugment` subset of the
 * removed-augment pile (see `EXCLUDED_API_NAME_PREFIXES` above) — Arena's
 * augment-crafting mechanic: spending a draft pick on gaining a Prismatic
 * Stat Anvil, gaining an extra augment slot, gaining a plain Stat Anvil,
 * "leveling" (upgrading) an existing augment, or replacing one, instead of a
 * normal augment offer. Unlike Guest of Honor, none of these belong to a
 * single champion, so there's no grouping structure to carry — just a flat,
 * explicitly ordered list (curated order, not alphabetical/catalog order,
 * same reasoning as `GUEST_OF_HONOR_CHAMPIONS`'s fixed array) that
 * `getMetaAugments` looks up against the real catalog for name/icon, and
 * `MetaAugments.tsx` renders one card per entry.
 */
const META_AUGMENT_API_NAMES = [
  "CraftingPrisStatAnvil",
  "CraftingAugmentSlot",
  "GainStatAnvil",
  "CraftingSellAugment",
  "ReplaceAugment",
] as const;
const META_AUGMENT_API_NAME_SET: ReadonlySet<string> = new Set(
  META_AUGMENT_API_NAMES,
);

// Cached for the life of the process rather than re-fetched per request
// (see CLAUDE.md §2), memoized as a promise so concurrent requests during a
// cold start share one fetch instead of racing to fetch it multiple times —
// same pattern as championData.ts's champion-name cache.
let augmentsPromise: Promise<CommunityDragonAugment[]> | null = null;

async function fetchAugments(): Promise<CommunityDragonAugment[]> {
  const res = await fetch(AUGMENTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Community Dragon augment data: ${res.status}`);
  }
  const json = (await res.json()) as CommunityDragonArenaData;
  return json.augments;
}

function getAugments(): Promise<CommunityDragonAugment[]> {
  augmentsPromise ??= fetchAugments();
  return augmentsPromise;
}

/** The normal in-game augment pool — everything `getAugments()` returns
 * minus the "GoH" and "Crafting" prefixed entries (see `isRemovedAugment`).
 * What `AugmentPicks`/`AugmentHallOfFame` should be built from. */
async function getCatalogAugments(): Promise<CommunityDragonAugment[]> {
  const augments = await getAugments();
  return augments.filter((augment) => !isRemovedAugment(augment.apiName));
}

/** Name/icon lookup for exactly the augments `GUEST_OF_HONOR_CHAMPIONS`
 * references — the "Guest of Honor" screen's own data, not the general
 * removed-augment reminder list. */
async function getGuestOfHonorAugmentDetails(): Promise<
  Map<number, { name: string; iconUrl: string }>
> {
  const augments = await getAugments();
  return new Map(
    augments
      .filter((augment) => GUEST_OF_HONOR_AUGMENT_IDS.has(augment.id))
      .map((augment) => [
        augment.id,
        { name: augment.name, iconUrl: augmentIconUrl(augment.iconLarge) },
      ]),
  );
}

/** The augment-crafting screen's own data — `META_AUGMENT_API_NAMES`
 * resolved against the real catalog for name/icon/id, in that same curated
 * order (not the catalog's own order), the same "explicit order over
 * alphabetical" choice as `getGuestOfHonorAugmentDetails`'s champion list. */
async function getMetaAugments(): Promise<CommunityDragonAugment[]> {
  const augments = await getAugments();
  const byApiName = new Map(augments.map((augment) => [augment.apiName, augment]));
  return META_AUGMENT_API_NAMES.map((apiName) => byApiName.get(apiName)).filter(
    (augment) => augment !== undefined,
  );
}

// Community Dragon serves these asset paths (already lowercase) under
// /latest/game/ — verified against a real icon URL resolving with a 200.
function augmentIconUrl(iconPath: string): string {
  return `https://raw.communitydragon.org/latest/game/${iconPath.toLowerCase()}`;
}

export {
  getCatalogAugments,
  getGuestOfHonorAugmentDetails,
  GUEST_OF_HONOR_CHAMPIONS,
  getMetaAugments,
  augmentIconUrl,
};
