/**
 * Riot routing values: which host each call goes to.
 *
 * League data lives on a **platform** (one game server: euw1, na1, ...), and
 * some APIs serve several platforms from one **regional** cluster (europe,
 * americas, asia, sea). Each host has its own rate limits, so the host a call
 * goes to is also the key of its rate-limit bucket (see rateLimiting/).
 *
 * Source: https://developer.riotgames.com/docs/lol#routing-values. OC1 moved
 * from AMERICAS to SEA for Match-V5 in June 2022. Account-V1 has no SEA
 * cluster and returns the same data from every cluster, so SEA platforms use
 * ASIA there.
 */

export const PLATFORMS = [
  "br1",
  "eun1",
  "euw1",
  "jp1",
  "kr",
  "la1",
  "la2",
  "me1",
  "na1",
  "oc1",
  "ru",
  "sg2",
  "tr1",
  "tw2",
  "vn2",
] as const;

export type Platform = (typeof PLATFORMS)[number];
export type Region = "americas" | "asia" | "europe" | "sea";
/** Either kind of routing value: what a request's host starts with. */
export type RoutingValue = Platform | Region;

/** Match-V5's cluster for each platform. */
const MATCH_REGION: Record<Platform, Region> = {
  br1: "americas",
  la1: "americas",
  la2: "americas",
  na1: "americas",
  jp1: "asia",
  kr: "asia",
  eun1: "europe",
  euw1: "europe",
  me1: "europe",
  ru: "europe",
  tr1: "europe",
  oc1: "sea",
  sg2: "sea",
  tw2: "sea",
  vn2: "sea",
};

export const REGION_LABEL: Record<Region, string> = {
  americas: "Americas",
  asia: "Asia",
  europe: "Europe",
  sea: "SEA",
};

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value.toLowerCase());
}

/**
 * Normalizes a platform code as stored in the database ("euw1", "EUW1") and
 * throws on one Riot doesn't route, so a typo fails loudly instead of
 * becoming a DNS error.
 */
export function toPlatform(value: string): Platform {
  const platform = value.toLowerCase();
  if (!isPlatform(platform)) throw new Error(`Unknown Riot platform "${value}": add it to PLATFORMS in riotApi/routing.ts`);
  return platform;
}

/**
 * The platform a match was played on: match ids start with it
 * ("EUW1_7851809865"), which is how match calls know their routing without
 * being told. Not necessarily the platform of the player whose history
 * listed it: Match-V5 lists a player's games on every platform of the
 * cluster (an ME1 player's EUW1 games too).
 */
export function platformOfMatch(matchId: string): Platform {
  const prefix = matchId.split("_")[0];
  if (!prefix || prefix === matchId) throw new Error(`Match id "${matchId}" has no platform prefix`);
  return toPlatform(prefix);
}

/** Cluster for Match-V5 calls about a player or match on this platform. */
export function matchRegion(platform: Platform): Region {
  return MATCH_REGION[platform];
}

/** Cluster for Account-V1: the platform's own, except SEA, which Account-V1 doesn't have. */
export function accountRegion(platform: Platform): Exclude<Region, "sea"> {
  const region = MATCH_REGION[platform];
  return region === "sea" ? "asia" : region;
}

export function hostFor(routing: RoutingValue) {
  return `https://${routing}.api.riotgames.com`;
}
