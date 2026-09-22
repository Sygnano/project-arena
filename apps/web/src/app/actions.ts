"use server";

import { headers } from "next/headers";
import { lookupRiotId, type LookupResult } from "@/lib/api";

/** The visitor's IP as the hosting proxy reports it (the first
 * `x-forwarded-for` entry is the original client), for the API's per-visitor
 * rate limit. Null in local dev, where nothing sets these. */
async function visitorIp(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip") || null;
}

/** Resolves a Riot ID. A search leaves `fetchMatches` off: it only queues a
 * refresh of an already-fetched, stale summoner. The summoner page's
 * "fetch matches" button sets it to queue a first fetch. */
export async function lookupSummoner(
  region: string,
  gameName: string,
  tagLine: string,
  fetchMatches = false,
): Promise<LookupResult> {
  return lookupRiotId(region, gameName.trim(), tagLine.trim(), fetchMatches, await visitorIp());
}
