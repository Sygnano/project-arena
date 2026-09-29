import type { SortMetric } from "./types";

/** Metrics that are plain counts rather than rates: they sort straight on
 * their value, with no `MIN_SAMPLE` demotion or dimming (a row's own count
 * IS its sample, so there's nothing to be noisy about). */
const COUNT_METRICS: readonly SortMetric[] = ["games", "roundsWon", "roundsLost"];

// An opponent needs at least this many shared matches before they're
// eligible for the sidebar's "BIGGEST NEMESIS" figure — same reasoning as
// Teammates' MIN_GAMES_FOR_BEST_DUO: a single unlucky loss to a
// rarely-repeated opponent would otherwise read as a "100%" nemesis off a
// sample of one.
const MIN_GAMES_FOR_NEMESIS = 5;

const TOP3_RATE_COLOR = "#e0b563";

const VS_YOU_COLOR = "var(--color-lol-garnet)";

const YOU_COLOR = "var(--color-lol-blue-300)";

/** our 1st · our winrate · you count · you bar · opponent · them bar ·
 * them count · their winrate · ahead. The two outer pairs of rate columns
 * mirror each other (our own record vs. this opponent's own record in the
 * same shared matches), framing the round-duel tug-of-war in the middle.
 * The bars are round duels won by each side (`roundsWon`/`roundsLost`),
 * growing outward from the name on one shared scale, so a row's combined
 * span is the number of rounds fought against that opponent. */
const ROW_GRID = "72px 64px 36px minmax(0,1fr) 190px minmax(0,1fr) 36px 64px 72px";

export { COUNT_METRICS, MIN_GAMES_FOR_NEMESIS, TOP3_RATE_COLOR, VS_YOU_COLOR, YOU_COLOR, ROW_GRID };
