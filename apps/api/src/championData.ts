// Data Dragon CDN version for static assets — kept in sync with
// apps/web/src/lib/riot.ts's own pinned version. Bump both together, see
// https://ddragon.leagueoflegends.com/api/versions.json
const DDRAGON_VERSION = "16.17.1";

interface DataDragonChampion {
  id: string;
  key: string;
  name: string;
}

interface DataDragonChampionList {
  data: Record<string, DataDragonChampion>;
}

// Cached for the life of the process rather than re-fetched per request
// (see CLAUDE.md §2 on caching static reference data locally). Memoized as
// a promise so concurrent requests during a cold start share one fetch
// instead of racing to fetch it multiple times.
let championListPromise: Promise<DataDragonChampion[]> | null = null;

function getChampionList(): Promise<DataDragonChampion[]> {
  championListPromise ??= fetchChampionList();
  return championListPromise;
}

async function fetchChampionList(): Promise<DataDragonChampion[]> {
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/champion.json`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Data Dragon champion list: ${res.status}`);
  }
  const json = (await res.json()) as DataDragonChampionList;
  return Object.values(json.data);
}

async function buildChampionNamesById(): Promise<Map<number, string>> {
  const byId = new Map<number, string>();
  for (const champion of await getChampionList()) {
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
  return buildChampionNamesById();
}

/**
 * Lowercased Riot champion key -> display name (e.g. "monkeyking" ->
 * "Wukong", "ksante" -> "K'Sante"). match_participants.championName is the
 * key, which is right for asset URLs but wrong to show a person. Lowercased
 * because Riot's match data and Data Dragon disagree on casing for at least
 * one champion ("FiddleSticks" vs "Fiddlesticks").
 */
async function getChampionDisplayNames(): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const champion of await getChampionList()) {
    names[champion.id.toLowerCase()] = champion.name;
  }
  return names;
}

export { getChampionNamesById, getChampionDisplayNames };
