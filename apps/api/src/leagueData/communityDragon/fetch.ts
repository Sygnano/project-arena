import type { CDragonArenaData, CDragonAugment, CDragonChampion, CDragonItem, CDragonSummonerSpell } from "./types.js";
import { CDRAGON_URLS } from "./urls.js";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`CommunityDragon ${res.status} for ${url}`);
  return (await res.json()) as T;
}

// Plain downloads, uncached: each catalog module caches what it builds from them.

export function fetchChampions() {
  return fetchJson<CDragonChampion[]>(CDRAGON_URLS.champions);
}

export function fetchItems() {
  return fetchJson<CDragonItem[]>(CDRAGON_URLS.items);
}

export function fetchSummonerSpells() {
  return fetchJson<CDragonSummonerSpell[]>(CDRAGON_URLS.summonerSpells);
}

export async function fetchAugments(): Promise<CDragonAugment[]> {
  return (await fetchJson<CDragonArenaData>(CDRAGON_URLS.arena)).augments;
}
