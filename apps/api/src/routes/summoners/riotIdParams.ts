import { z } from "zod";
import { isPlatform } from "../../riotApi/index.js";

/** The `:region/:gameName/:tagLine` of every summoner route. */
export type RiotIdParams = { region: string; gameName: string; tagLine: string };

// Riot ID rules: a 3-16 character game name (any script's letters, digits,
// spaces, plus combining marks for scripts like Thai) and a 3-5 character
// alphanumeric tag line, counted in code points since names can use
// non-Latin scripts. Checked against every stored name (40,835, 2026-09):
// none has anything else. Everything else is refused, so a URL can't put
// markup, slashes, bidi overrides or line separators into a preview card, a
// log line or a request. Mirrored in apps/web/src/lib/riot-id.ts.
const GAME_NAME_PATTERN = /^[\p{L}\p{N}\p{M} ]+$/u;
// Riot's own default tags that break the 3-5 rule: OC1 accounts get "#OC".
const SHORT_DEFAULT_TAG_LINES = new Set(["OC"]);

const riotIdSchema = z.object({
  region: z
    .string()
    .transform((region) => region.toLowerCase())
    .refine(isPlatform),
  gameName: z
    .string()
    .trim()
    .refine((name) => [...name].length >= 3 && [...name].length <= 16 && GAME_NAME_PATTERN.test(name)),
  tagLine: z
    .string()
    .trim()
    .refine((tag) => /^[\p{L}\p{N}]{3,5}$/u.test(tag) || SHORT_DEFAULT_TAG_LINES.has(tag.toUpperCase())),
});

/** The validated Riot ID, or null when it can't be a real one. */
export function parseRiotIdParams(params: unknown): RiotIdParams | null {
  const parsed = riotIdSchema.safeParse(params);
  return parsed.success ? parsed.data : null;
}
