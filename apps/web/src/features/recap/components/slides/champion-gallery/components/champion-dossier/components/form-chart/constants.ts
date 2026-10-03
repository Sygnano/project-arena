/** Horizontal room per game on the form chart. Past what fits in the cell,
 * the chart scrolls sideways (opening on the newest games). */
const FORM_STEP_PX = 22;

/** Room kept around the plot so edge diamonds and their glow aren't cut —
 * wider on the sides, where the newest game's outlined diamond sits right
 * against the scroller's edge. */
const FORM_PAD_PX = 8;

const FORM_PAD_X_PX = 16;

export { FORM_PAD_PX, FORM_PAD_X_PX, FORM_STEP_PX };
