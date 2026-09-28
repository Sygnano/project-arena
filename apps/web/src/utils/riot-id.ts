/**
 * Parses a "GameName-TagLine" URL segment. Splits on the LAST hyphen since
 * a game name can itself contain hyphens, but a tag line doesn't. Null
 * unless both halves follow the Riot ID rules below: the page, its link
 * preview and the refresh proxy echo or forward what this returns, so a URL
 * can't put arbitrary text in a preview card or odd path segments ("..") in
 * a request to the API.
 */
export function parseRiotIdSlug(rawSlug: string): { gameName: string; tagLine: string } | null {
  // Next hands dynamic params over still percent-encoded ("Nobody%20Here"),
  // which then got encoded a second time on the way to the API. Riot IDs
  // can't contain "%", so decoding can't mangle a real name.
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    // Malformed escape: parse it as typed.
  }
  const separatorIndex = slug.lastIndexOf("-");
  if (separatorIndex <= 0 || separatorIndex === slug.length - 1) return null;
  const gameName = slug.slice(0, separatorIndex);
  const tagLine = slug.slice(separatorIndex + 1);
  if (gameNameError(gameName) || tagLineError(tagLine)) return null;
  return { gameName, tagLine };
}

/** Builds the summoner page path for a Riot ID — the inverse of
 * `parseRiotIdSlug` (e.g. `/summoner/euw1/Sygnano-EUW`). */
export function summonerPath(region: string, gameName: string, tagLine: string): string {
  return `/summoner/${encodeURIComponent(region.toLowerCase())}/${encodeURIComponent(`${gameName}-${tagLine}`)}`;
}

// Riot ID rules (mirrored by the API's routes/summoners/riotIdParams.ts): the game
// name is 3-16 characters of any script's letters, digits or spaces (plus
// combining marks, which scripts like Thai need); the tag line is 3-5
// letters or digits. Neither is case-sensitive. Lengths
// count code points, so a Korean or Cyrillic name isn't measured in UTF-16
// halves.
export const GAME_NAME_LENGTH = { min: 3, max: 16 } as const;
export const TAG_LINE_LENGTH = { min: 3, max: 5 } as const;

// Riot's own default tags that break the 3-5 rule: OC1 accounts get "#OC".
const SHORT_DEFAULT_TAG_LINES = new Set(["OC"]);

const GAME_NAME_PATTERN = /^[\p{L}\p{N}\p{M} ]+$/u;
const TAG_LINE_PATTERN = /^[\p{L}\p{N}]+$/u;

export function gameNameError(gameName: string): string | null {
  const length = [...gameName.trim()].length;
  if (length === 0) return "Enter a game name.";
  if (length < GAME_NAME_LENGTH.min || length > GAME_NAME_LENGTH.max) {
    return `Game names are ${GAME_NAME_LENGTH.min}–${GAME_NAME_LENGTH.max} characters.`;
  }
  if (!GAME_NAME_PATTERN.test(gameName.trim())) return "Game names only have letters, numbers and spaces.";
  return null;
}

export function tagLineError(tagLine: string): string | null {
  const tag = tagLine.trim();
  if (tag.length === 0) return "Enter the tag after the #.";
  if (SHORT_DEFAULT_TAG_LINES.has(tag.toUpperCase())) return null;
  const length = [...tag].length;
  if (!TAG_LINE_PATTERN.test(tag) || length < TAG_LINE_LENGTH.min || length > TAG_LINE_LENGTH.max) {
    return `Tags are ${TAG_LINE_LENGTH.min}–${TAG_LINE_LENGTH.max} letters or numbers.`;
  }
  return null;
}

/** Keeps only what a tag line may contain, capped at its max length. */
export function sanitizeTagLine(value: string): string {
  return [...value.replace(/[^\p{L}\p{N}]/gu, "")].slice(0, TAG_LINE_LENGTH.max).join("");
}
