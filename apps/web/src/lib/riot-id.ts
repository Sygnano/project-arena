/**
 * Parses a "GameName-TagLine" URL segment. Splits on the LAST hyphen since
 * a game name can itself contain hyphens, but a tag line doesn't.
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
  return {
    gameName: slug.slice(0, separatorIndex),
    tagLine: slug.slice(separatorIndex + 1),
  };
}

/** Builds the summoner page path for a Riot ID — the inverse of
 * `parseRiotIdSlug` (e.g. `/summoner/euw1/Sygnano-EUW`). */
export function summonerPath(region: string, gameName: string, tagLine: string): string {
  return `/summoner/${encodeURIComponent(region.toLowerCase())}/${encodeURIComponent(`${gameName}-${tagLine}`)}`;
}

// Riot ID rules (mirrored by the API's routes/summoners/riotIdParams.ts): the game
// name is 3-16 characters of any script's letters, digits or spaces; the
// tag line is 3-5 letters or digits. Neither is case-sensitive. Lengths
// count code points, so a Korean or Cyrillic name isn't measured in UTF-16
// halves.
export const GAME_NAME_LENGTH = { min: 3, max: 16 } as const;
export const TAG_LINE_LENGTH = { min: 3, max: 5 } as const;

const TAG_LINE_PATTERN = /^[\p{L}\p{N}]+$/u;

export function gameNameError(gameName: string): string | null {
  const length = [...gameName.trim()].length;
  if (length === 0) return "Enter a game name.";
  if (length < GAME_NAME_LENGTH.min || length > GAME_NAME_LENGTH.max) {
    return `Game names are ${GAME_NAME_LENGTH.min}–${GAME_NAME_LENGTH.max} characters.`;
  }
  return null;
}

export function tagLineError(tagLine: string): string | null {
  const tag = tagLine.trim();
  if (tag.length === 0) return "Enter the tag after the #.";
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
