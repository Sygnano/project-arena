/**
 * Parses a "GameName-TagLine" URL segment. Splits on the LAST hyphen since
 * a game name can itself contain hyphens, but a tag line doesn't.
 */
export function parseRiotIdSlug(slug: string): { gameName: string; tagLine: string } | null {
  const separatorIndex = slug.lastIndexOf("-");
  if (separatorIndex <= 0 || separatorIndex === slug.length - 1) return null;
  return {
    gameName: slug.slice(0, separatorIndex),
    tagLine: slug.slice(separatorIndex + 1),
  };
}
