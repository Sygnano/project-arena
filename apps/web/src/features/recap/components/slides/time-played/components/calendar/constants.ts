import type { Tier } from "@/utils/tier-bars";

/**
 * Day-by-day activity calendar via Nivo's Time Range chart
 * (https://nivo.rocks/time-range/) rather than its plain Calendar chart —
 * Calendar always renders full Jan-to-Dec year(s) spanning `from`/`to` (it
 * only uses those to pick which years to include), which left most of the
 * grid empty for a summoner tracked for less than a year. TimeRange instead
 * lays out exactly the `from`-to-`to` window, so the grid genuinely starts
 * at the week of the summoner's earliest tracked match instead of padding
 * back to January.
 *
 * Uses our vendored copy of nivo's TimeRange (`src/vendor/nivo-calendar`,
 * see its README) rather than the published `@nivo/calendar`: upstream's
 * TimeRange silently ignores the `align` prop (unlike its own Calendar
 * chart, which honors it via alignBox), always rendering the day grid
 * flush top-left, which left visibly uncentered dead space whenever
 * `square` cell sizing ended up bound by one axis. The copy's
 * `computeOrigin` step (compute/timeRange.ts) makes `align` (default
 * "center") actually center the grid.
 *
 * Each day is one flat rarity tier (silver/gold/prismatic), no gradient
 * between them. Nivo sets a cell's color as an inline `style.fill`, so the
 * color scale returns `url(#…)` for each tier, pointing at the SVG gradients
 * rendered beside the chart (`TierFillDefs`); globals.css matches that fill to
 * add the glow. `value` is the tier's index in `TIER_ORDER`, and the scale
 * is a plain `(value) => color` function (the vendored `ColorScale` escape
 * hatch); `.ticks` is stubbed since no legend is rendered here.
 *
 * Nivo's color scale only maps a single numeric `value` per day, so `value`
 * carries whatever `mode` needs (games played, or average placement) — the
 * tooltip and the `DetailBand` below need more than that one number, so
 * both close over `statsByDay` and look the day back up by date rather than
 * trying to thread extra fields through Nivo's datum.
 *
 * Lives alongside TimePlayed (its only consumer, as a carousel slide) rather
 * than as its own top-level module/CategorySection — no wrapper here, the
 * parent supplies that.
 */
const PRISMATIC_FILL_ID = "calendar-prismatic-fill";

const GOLD_FILL_ID = "calendar-gold-fill";

const SILVER_FILL_ID = "calendar-silver-fill";

const TIER_ORDER: Tier[] = ["silver", "gold", "prismatic"];

const TIER_FILL: Record<Tier, string> = {
  silver: `url(#${SILVER_FILL_ID})`,
  gold: `url(#${GOLD_FILL_ID})`,
  prismatic: `url(#${PRISMATIC_FILL_ID})`,
};

/** The staggered entrance the day grid plays on mount and again whenever
 * `mode` recolors it — without it the calendar is the one chart on the page
 * that simply appears (HourStrip's bars grow in), and a recolor swapped every
 * cell's fill at once with nothing to draw the eye across the change.
 *
 * Driven from an effect over the real `<rect>`s rather than from React,
 * because Nivo owns that subtree: it renders the cells itself, so there is no
 * per-cell element here to hang a `motion` component or a `key` off. For the
 * same reason this uses the Web Animations API instead of a CSS class — the
 * `animation` property on these rects is already taken by the Prismatic glow
 * (see globals.css), and a second CSS animation would have to either lose to
 * it on specificity or clobber it; `element.animate()` composes with it
 * instead. Cells are staggered by grid position (column first, so the wave
 * reads left-to-right like the timeline the calendar is), which needs the
 * laid-out `x`/`y` attributes — hence reading them off the DOM.
 */
const ENTRANCE_MS = 600;

const COLUMN_STAGGER_MS = 15;

const ROW_STAGGER_MS = 8;

export {
  COLUMN_STAGGER_MS,
  ENTRANCE_MS,
  GOLD_FILL_ID,
  PRISMATIC_FILL_ID,
  ROW_STAGGER_MS,
  SILVER_FILL_ID,
  TIER_FILL,
  TIER_ORDER,
};
