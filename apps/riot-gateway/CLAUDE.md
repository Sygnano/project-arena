# apps/riot-gateway

Read `README.md` here first. The rules below are the user's decisions about its behavior.

- The only process holding `RIOT_API_KEY`. Run exactly one: its limiter state is in memory.
- Rate limits are kept per Riot host (routing value: `europe`, `euw1`, ...), taken from Riot's
  response headers, so a production key needs no code change.
- Each host sends its requests strictly by priority bucket, `PRIORITIES` in
  `packages/riot/src/priority.ts` (`lookup` > `refresh` > `firstFetch` > `upkeep` > `crawler`):
  a bucket goes out only once every bucket above it is empty on that host; first come first
  served within one. A new bucket (e.g. a future `vip`) is one entry there.
- **A bucket is never full**: no size cap, no "queue full" refusal, no maximum wait, no
  anti-starvation rule. A lower bucket just waits while higher ones keep receiving requests.
- Hold events are event-driven: a waiter hears only when its standing changes (queue position,
  or next in line for Riot's rate limit), never on a timer, and only in buckets with
  `hearsHolds` (`lookup`, `refresh`, `firstFetch`). Size the design for about 1,000 waiters per
  host. A WebSocket wouldn't help at this scale.
- No parallel fetches: callers send one call at a time per lane or worker, and limiting how much
  a caller sends is the caller's job.
- One route per Riot endpoint, answering a server-sent event stream: `hold` events, then Riot's
  body verbatim. Callers parse and store it; the gateway knows nothing about the database.
