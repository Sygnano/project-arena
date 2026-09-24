import type { Platform, Priority, RoutingValue } from "@arena/riot";

/** Riot's own names for its APIs, as the developer portal lists them. */
export type RiotApiName = "Account-V1" | "Summoner-V4" | "Match-V5";

/**
 * One Riot request, described once by an endpoint file (plus the caller's
 * priority, added by its route) and read by every layer below it: the
 * scheduler queues it by `routing` + `priority`, the rate limiter picks its
 * buckets from `routing` + `api`/`method`, the HTTP client builds the URL
 * from it, the logger prints it.
 */
export interface RiotCall {
  api: RiotApiName;
  /** Our method name (`getMatch`). With `api`, it identifies the Riot
   * endpoint, which is what Riot's method rate limits count. */
  method: string;
  /** The player's or match's platform. Always shown in logs, even when the
   * call goes to a regional cluster. */
  platform: Platform;
  /** Where the call goes: the platform itself, or its regional cluster. */
  routing: RoutingValue;
  /** Path under the host, already URL-encoded. */
  path: string;
  /** Query parameters; `undefined` values are left out. */
  query?: Record<string, string | number | undefined>;
  /** The values that identify this call in a log line (match id, Riot ID, ...). */
  args: string[];
  /** The caller's bucket (`x-riot-priority`). */
  priority: Priority;
}

/** What an endpoint file builds: a call, before a route adds its priority. */
export type RiotCallSpec = Omit<RiotCall, "priority">;
