"use server";

import { lookupRiotId, type LookupResult } from "@/lib/api";

/** The search box's submit: resolves a Riot ID and queues its refresh. */
export async function lookupSummoner(region: string, gameName: string, tagLine: string): Promise<LookupResult> {
  return lookupRiotId(region, gameName.trim(), tagLine.trim());
}
