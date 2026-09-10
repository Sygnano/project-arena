// Arena augment data isn't published on Data Dragon at all — Community
// Dragon's dedicated Arena endpoint is the only source (see CLAUDE.md §2).
// `latest` tracks the current patch automatically.
const AUGMENTS_URL = "https://raw.communitydragon.org/latest/cdragon/arena/en_us.json";

interface CommunityDragonAugment {
  id: number;
  name: string;
  rarity: number;
  iconLarge: string;
}

interface CommunityDragonArenaData {
  augments: CommunityDragonAugment[];
}

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

// Community Dragon serves these asset paths (already lowercase) under
// /latest/game/ — verified against a real icon URL resolving with a 200.
function augmentIconUrl(iconPath: string): string {
  return `https://raw.communitydragon.org/latest/game/${iconPath.toLowerCase()}`;
}

export { getAugments, augmentIconUrl };
