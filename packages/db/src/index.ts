export * from "./schema.js";
export * from "./client.js";
export * from "./migrate.js";
export * from "./compression.js";
export * from "./parseMatch.js";
export * from "./parseRounds.js";

// Re-exported so consumers only need a single drizzle-orm version (this
// package's) instead of adding their own dependency on it — see CLAUDE.md
// working conventions.
export { eq, and, or, desc, asc, sql, inArray, isNull, isNotNull, lt } from "drizzle-orm";
// `alias` lives under the pg-core subpath rather than the main drizzle-orm
// export, needed for self-joining match_participants against itself (e.g.
// pairing a summoner's own row with a teammate's row on matchId+teamId).
export { alias } from "drizzle-orm/pg-core";
