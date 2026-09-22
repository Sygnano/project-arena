import type { RiotCall } from "./types.js";

/**
 * A Riot request that failed for good: a non-retryable status, or a
 * retryable one (429, 5xx, network) that kept failing past the retry budget.
 * `status` is 0 when no response came back at all.
 */
export class RiotApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly call: RiotCall,
    message: string,
    /** Fails every request the same way (bad key, PUUID from another Riot
     * app), so batch jobs should stop instead of moving on. */
    public readonly fatal = false,
  ) {
    super(message);
    this.name = "RiotApiError";
  }
}

/** Builds the error for a final non-2xx response. Riot says to act on the
 * status alone, but a 400's body is the only way to tell a foreign PUUID. */
export function errorFromResponse(call: RiotCall, status: number, body: string): RiotApiError {
  const what = `${call.api} ${call.method}(${call.args.join(", ")})`;
  // PUUIDs are encrypted per Riot app (CLAUDE.md §2).
  if (status === 400 && body.includes("Exception decrypting")) {
    return new RiotApiError(
      status,
      call,
      `Riot API 400 for ${what}: PUUID was issued to a different Riot app than RIOT_API_KEY's. Run \`pnpm --filter @arena/db remap-puuids\``,
      true,
    );
  }
  if (status === 401 || status === 403) {
    return new RiotApiError(status, call, `Riot API ${status} for ${what}: RIOT_API_KEY is missing, invalid or expired (dev keys last 24h)`, true);
  }
  return new RiotApiError(status, call, `Riot API ${status} for ${what}`);
}
