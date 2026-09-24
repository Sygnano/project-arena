/**
 * A Riot request that failed for good, as the gateway reported it (Riot's
 * status and a description), or the gateway itself staying unreachable
 * (`status` 0, like a Riot request that got no response).
 */
export class RiotApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Fails every request the same way (bad key, PUUID from another Riot
     * app, wrong gateway secret), so batch jobs should stop instead of
     * moving on. */
    public readonly fatal = false,
  ) {
    super(message);
    this.name = "RiotApiError";
  }
}
