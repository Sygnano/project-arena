/**
 * A Riot ID's lookup key, `summoners.riot_id_key`: trimmed, Unicode
 * lowercase and NFC-normalized, "gamename#tag". Riot IDs are typed by hand
 * and aren't case-sensitive, and Postgres's `lower()` under this database's
 * C collation only lowercases ASCII (a quarter of stored names aren't), so
 * the key is computed here, the same way for storing and for looking up.
 */
export function riotIdKey(gameName: string, tagLine: string): string {
  const part = (value: string) => value.trim().toLowerCase().normalize("NFC");
  return `${part(gameName)}#${part(tagLine)}`;
}

/** The Riot ID columns of a `summoners` row: names trimmed (match data can
 * carry a trailing space, which made the row unreachable by URL) and the key. */
export function riotIdColumns(gameName: string, tagLine: string) {
  return {
    riotIdGameName: gameName.trim(),
    riotIdTagline: tagLine.trim(),
    riotIdKey: riotIdKey(gameName, tagLine),
  };
}
