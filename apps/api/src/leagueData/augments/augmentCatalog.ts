import { fetchAugments } from "../communityDragon/fetch.js";
import type { CDragonAugment } from "../communityDragon/types.js";
import { gameAssetUrl } from "../communityDragon/urls.js";
import { memoizeAsync } from "../memoize.js";
import { META_AUGMENT_API_NAMES, NON_DRAFT_API_NAME_PREFIXES, NON_DRAFT_API_NAMES } from "./augmentGroups.js";

export interface Augment {
  /** What Match-V5's `playerAugment1`-`6` carry. */
  id: number;
  apiName: string;
  name: string;
  /** 0 Silver, 1 Gold, 2 Prismatic, 4 internal/meta. */
  rarity: number;
  iconUrl: string;
}

function toAugment(raw: CDragonAugment): Augment {
  return { id: raw.id, apiName: raw.apiName, name: raw.name, rarity: raw.rarity, iconUrl: gameAssetUrl(raw.iconLarge) };
}

function isDraftable(augment: Augment) {
  return (
    !NON_DRAFT_API_NAME_PREFIXES.some((prefix) => augment.apiName.startsWith(prefix)) &&
    !NON_DRAFT_API_NAMES.has(augment.apiName)
  );
}

/** Every Arena augment (source: CommunityDragon, as Data Dragon has none). */
export class AugmentCatalog {
  private readonly byId: Map<number, Augment>;
  private readonly byApiName: Map<string, Augment>;

  constructor(private readonly augments: Augment[]) {
    this.byId = new Map(augments.map((augment) => [augment.id, augment]));
    this.byApiName = new Map(augments.map((augment) => [augment.apiName, augment]));
  }

  all(): readonly Augment[] {
    return this.augments;
  }

  get(id: number): Augment | undefined {
    return this.byId.get(id);
  }

  /** The normal draft pool: what the augment stats are built from. */
  draftable(): Augment[] {
    return this.augments.filter(isDraftable);
  }

  /** The augment-crafting choices, in `META_AUGMENT_API_NAMES` order. */
  meta(): Augment[] {
    return META_AUGMENT_API_NAMES.map((apiName) => this.byApiName.get(apiName)).filter(
      (augment) => augment !== undefined,
    );
  }
}

export const getAugmentCatalog = memoizeAsync(async () => new AugmentCatalog((await fetchAugments()).map(toAugment)));
