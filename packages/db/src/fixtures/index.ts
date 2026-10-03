import fs from "node:fs";
import type { RiotArenaMatchDto, RiotMatchTimelineDto } from "@arena/types";
import { decompressJson } from "../compression.js";

/** A real Arena match (6 teams of 3) with PUUIDs and player names replaced, from
 * `pnpm --filter @arena/db match-json <id> src/fixtures --scrub --brotli`. */
export const FIXTURE_MATCH_ID = "EUW1_7990999348";

function load<T>(name: string): T {
  return decompressJson<T>(fs.readFileSync(new URL(name, import.meta.url)));
}

/** Fresh copies on every call, so a test can change them freely. */
export function loadFixtureMatch(): { dto: RiotArenaMatchDto; timeline: RiotMatchTimelineDto } {
  return {
    dto: load<RiotArenaMatchDto>(`${FIXTURE_MATCH_ID}.json.br`),
    timeline: load<RiotMatchTimelineDto>(`${FIXTURE_MATCH_ID}.timeline.json.br`),
  };
}
