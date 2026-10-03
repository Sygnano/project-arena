// A duo needs at least this many shared matches before it's eligible for the
// sidebar's "BEST DUO" figure — same reasoning as TeamSynergy's own
// TEAM_SYNERGY_MIN_PAIR_SAMPLE: a single lucky top1 with a rarely-repeated
// partner would otherwise read as a "100% win rate" duo off a sample of one.
const MIN_GAMES_FOR_BEST_DUO = 5;

const TOP3_RATE_COLOR = "#e0b563";

const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

const REST_COLOR = "rgba(240,230,210,.14)";

const BASELINE_COLOR = "var(--color-lol-blue-300)";

/** avatar · name · placement strip · games · top 3 · Δ · 1st. */
const ROW_GRID = "36px minmax(110px,190px) minmax(0,1fr) 52px 56px 76px 48px";

export { BASELINE_COLOR, FIRST_RATE_COLOR, MIN_GAMES_FOR_BEST_DUO, REST_COLOR, ROW_GRID, TOP3_RATE_COLOR };
