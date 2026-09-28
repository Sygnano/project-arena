/**
 * One section of the summoner page's scroll sequence.
 *
 * Two layout modes (see the `deck`/`flow` custom variants in globals.css):
 * - **deck** (≥1280px wide and ≥860px tall): the designed full-viewport,
 *   scroll-snapped slide — a fixed composition capped at 1920×1080.
 * - **flow** (anything smaller): the section grows to fit its content and the
 *   page scrolls normally. The identity column stacks above the panel below
 *   `xl`, and the panel gets an explicit height so charts and lists that fill
 *   their panel still have one to fill. Previously every viewport got the deck
 *   layout inside `h-screen overflow-hidden`, which silently clipped a sidebar
 *   slide's bottom ~200px on a 1366×768 laptop and broke entirely on phones.
 *
 * The section's DOM id and bottom cue come from the slide registry
 * (`useSlide`), not from props.
 */
/** The panel column comes up a beat after the title column, so a section
 * reads left-to-right (title, then its content) instead of arriving flat. */
const PANEL_REVEAL_DELAY_MS = 120;

export { PANEL_REVEAL_DELAY_MS };
