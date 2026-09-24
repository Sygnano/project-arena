/**
 * League queue ids, for filtering Match-V5 match lists (`queue` option of
 * `match.getMatchIdsByPuuid` / `match.getAllMatchIdsByPuuid`).
 *
 * The queue is a parameter, never a constant baked into a call: pass the one
 * you want, or leave it out to get every queue. To support a new queue, add
 * it here and pass `Queue.YOUR_QUEUE` at the call site. Any number works too,
 * so an id missing from this list doesn't block anything.
 *
 * Riot publishes the list at
 * https://static.developer.riotgames.com/docs/lol/queues.json, but it lags
 * behind the game: Arena's current queue (1750) isn't in it and was taken
 * from real match data instead (CLAUDE.md §2). Riot has renumbered queues
 * before, so check a real match's `info.queueId` when adding one.
 */
export const Queue = {
  /** Arena, 6 teams of 3. Verified on real matches (patch 16.10+). Not in queues.json. */
  ARENA: 1750,
  /** Arena as queues.json lists it (2023-2024 lobbies). */
  ARENA_LEGACY: 1700,
  /** Arena's 16-player lobby, per queues.json. */
  ARENA_16_PLAYERS: 1710,
  DRAFT_PICK: 400,
  RANKED_SOLO_DUO: 420,
  RANKED_FLEX: 440,
  ARAM: 450,
  SWIFTPLAY: 480,
  QUICKPLAY: 490,
  CLASH: 700,
  ARAM_MAYHEM: 2400,
} as const;

/** A queue id: one of `Queue`'s, or any other id Riot uses. */
export type QueueId = (typeof Queue)[keyof typeof Queue] | (number & {});
