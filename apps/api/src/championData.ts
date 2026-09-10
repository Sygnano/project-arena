// Data Dragon CDN version for static assets — kept in sync with
// apps/web/src/lib/riot.ts's own pinned version. Bump both together, see
// https://ddragon.leagueoflegends.com/api/versions.json
const DDRAGON_VERSION = "16.17.1";

interface DataDragonChampion {
  id: string;
  key: string;
}

interface DataDragonChampionList {
  data: Record<string, DataDragonChampion>;
}

// Cached for the life of the process rather than re-fetched per request
// (see CLAUDE.md §2 on caching static reference data locally). Memoized as
// a promise so concurrent requests during a cold start share one fetch
// instead of racing to fetch it multiple times.
let championNamesPromise: Promise<Map<number, string>> | null = null;

async function fetchChampionNamesById(): Promise<Map<number, string>> {
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/champion.json`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Data Dragon champion list: ${res.status}`);
  }
  const json = (await res.json()) as DataDragonChampionList;
  const byId = new Map<number, string>();
  for (const champion of Object.values(json.data)) {
    // Data Dragon's `id` (e.g. "MonkeyKing") is the same PascalCase name
    // Riot's Match-V5 API puts in match_participants.championName — this is
    // what apps/web's championIconUrl() expects, not the display `name`
    // (e.g. "Wukong").
    byId.set(Number(champion.key), champion.id);
  }
  return byId;
}

/** Champion ID -> Riot-style championName (e.g. 62 -> "MonkeyKing"), sourced
 * from Data Dragon rather than match_participants — needed for champions
 * that have never actually been picked in any tracked match (a champion
 * banned in 100% of matches, for instance, can by definition never appear
 * there). */
function getChampionNamesById(): Promise<Map<number, string>> {
  championNamesPromise ??= fetchChampionNamesById();
  return championNamesPromise;
}

export { getChampionNamesById };
