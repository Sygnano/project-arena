// Data Dragon CDN version for static assets (profile icons, etc). Bump
// periodically — see https://ddragon.leagueoflegends.com/api/versions.json
const DDRAGON_VERSION = "16.17.1";

export function itemIconUrl(itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`;
}

export function profileIconUrl(profileIconId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${profileIconId}.png`;
}

// match_participants.championName (Riot's Match-V5 field) matches Data
// Dragon's champion id for every champion except these — verified against
// all 172 distinct champions actually seen in our tracked data (checked
// 2026-09), not assumed. Add to this map if a future patch introduces
// another mismatch.
const CHAMPION_NAME_OVERRIDES: Record<string, string> = {
  FiddleSticks: "Fiddlesticks",
};

export function championIconUrl(championName: string): string {
  const id = CHAMPION_NAME_OVERRIDES[championName] ?? championName;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;
}

/**
 * The champion's PORTRAIT "loading screen" art (308x560) rather than the
 * square 120x120 icon `championIconUrl` returns — for anywhere a champion
 * fills a tall card (the champion gallery's cards), where the square icon
 * would have to be cropped to a narrow center strip to cover the same box.
 *
 * For a WIDE box use `championSplashUrl` instead: this image is only 308px
 * across, so covering a landscape container upscales it several times over
 * and reads as a blown-up crop.
 *
 * Same name-override handling as `championIconUrl`, but note these art paths
 * carry no Data Dragon version segment — they always serve current art. The
 * `_0` suffix is the base skin, the only one Arena's match data identifies a
 * champion by.
 */
export function championLoadingUrl(championName: string): string {
  const id = CHAMPION_NAME_OVERRIDES[championName] ?? championName;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg`;
}

/**
 * The champion's full LANDSCAPE splash art (1215x717) — the counterpart to
 * `championLoadingUrl` for wide containers, such as an accordion panel's
 * background. Sized so a full-height panel crops rather than magnifies it.
 */
export function championSplashUrl(championName: string): string {
  const id = CHAMPION_NAME_OVERRIDES[championName] ?? championName;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`;
}

// Riot platform codes -> display name, for `SummonerProfile.region` (e.g.
// "euw1", matching the `[platform]` route param — see summoners.ts). Only
// the platform actually tracked today (EUW1, per CLAUDE.md §1) is verified
// against a real summoner; the rest follow Riot's own published platform
// list and op.gg-style naming, add/correct as new regions are tracked.
const PLATFORM_REGION_NAME: Record<string, string> = {
  euw1: "Europe West",
  eun1: "Europe Nordic & East",
  na1: "North America",
  kr: "Korea",
  jp1: "Japan",
  br1: "Brazil",
  la1: "Latin America North",
  la2: "Latin America South",
  oc1: "Oceania",
  tr1: "Turkey",
  ru: "Russia",
};

/** Platforms the search offers, in picker order, with the short labels
 * players know them by. The API routes the same set (`REGIONAL_CLUSTER` in
 * apps/api/src/riot/client.ts); SEA servers would also need Riot's `sea`
 * match cluster there. */
export const SEARCH_PLATFORMS = [
  { id: "euw1", label: "EUW" },
  { id: "eun1", label: "EUNE" },
  { id: "na1", label: "NA" },
  { id: "kr", label: "KR" },
  { id: "jp1", label: "JP" },
  { id: "br1", label: "BR" },
  { id: "la1", label: "LAN" },
  { id: "la2", label: "LAS" },
  { id: "oc1", label: "OCE" },
  { id: "tr1", label: "TR" },
  { id: "ru", label: "RU" },
] as const;

export const DEFAULT_SEARCH_PLATFORM = "euw1";

/** Whether a `[platform]` URL segment is a server the search offers. */
export function isKnownPlatform(platform: string): boolean {
  const id = platform.toLowerCase();
  return SEARCH_PLATFORMS.some((option) => option.id === id);
}

export function platformRegionName(platform: string): string {
  return PLATFORM_REGION_NAME[platform.toLowerCase()] ?? platform.toUpperCase();
}
