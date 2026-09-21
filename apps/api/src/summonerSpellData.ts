// Data Dragon CDN version — kept in sync with championData.ts's pinned
// version. Bump both together.
const DDRAGON_VERSION = "16.17.1";

interface DataDragonSummonerSpell {
  id: string;
  key: string;
  name: string;
  image: { full: string };
}

interface DataDragonSummonerSpellList {
  data: Record<string, DataDragonSummonerSpell>;
}

export interface SummonerSpellInfo {
  name: string;
  iconUrl: string;
}

// Cached for the life of the process, same as the champion list (CLAUDE.md
// §2 on caching static reference data). Arena has its own spell ids (2201
// Flee, 2202 Flash — "SummonerCherryHold"/"SummonerCherryFlash"), which
// summoner.json lists alongside the Summoner's Rift ones.
let spellsPromise: Promise<Map<number, SummonerSpellInfo>> | null = null;

/** Summoner spell id (summoner.json `key`, what Match-V5's `summoner1Id`/
 * `summoner2Id` carry) -> name and icon. */
function getSummonerSpells(): Promise<Map<number, SummonerSpellInfo>> {
  spellsPromise ??= fetchSummonerSpells();
  // A failed fetch must not stay cached as a rejected promise.
  spellsPromise.catch(() => {
    spellsPromise = null;
  });
  return spellsPromise;
}

async function fetchSummonerSpells(): Promise<Map<number, SummonerSpellInfo>> {
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/summoner.json`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Data Dragon summoner spells: ${res.status}`);
  }
  const json = (await res.json()) as DataDragonSummonerSpellList;
  const byId = new Map<number, SummonerSpellInfo>();
  for (const spell of Object.values(json.data)) {
    byId.set(Number(spell.key), {
      name: spell.name,
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${spell.image.full}`,
    });
  }
  return byId;
}

export { getSummonerSpells };
