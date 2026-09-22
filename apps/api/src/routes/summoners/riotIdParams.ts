import { z } from "zod";
import { isPlatform } from "../../riotApi/index.js";

/** The `:region/:gameName/:tagLine` of every summoner route. */
export type RiotIdParams = { region: string; gameName: string; tagLine: string };

// Riot ID rules: a 3-16 character game name (any letters, digits, spaces)
// and a 3-5 character alphanumeric tag line, counted in code points since
// names can use non-Latin scripts. Mirrored in apps/web/src/lib/riot-id.ts.
const riotIdSchema = z.object({
  region: z
    .string()
    .transform((region) => region.toLowerCase())
    .refine(isPlatform),
  gameName: z
    .string()
    .trim()
    .refine((name) => [...name].length >= 3 && [...name].length <= 16 && !name.includes("#")),
  tagLine: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N}]{3,5}$/u),
});

/** The validated Riot ID, or null when it can't be a real one. */
export function parseRiotIdParams(params: unknown): RiotIdParams | null {
  const parsed = riotIdSchema.safeParse(params);
  return parsed.success ? parsed.data : null;
}
