const COLUMN_WIDTH_CLASS = "w-13.5";

const ICON_SIZE_CLASS = "size-9";

/** Below this, a segment's own height can't fit a legible number without
 * either clipping or bleeding into the segment above/below it — the label
 * is dropped rather than shrunk further, since an unreadably tiny number is
 * worse than no number (the segment's `title` still carries the exact value
 * on hover). ~20px comfortably fits the 12px label used below. */
const MIN_SEGMENT_LABEL_HEIGHT = 20;

/** The `heightUnit="percent"` equivalent of `MIN_SEGMENT_LABEL_HEIGHT` —
 * roughly the same fraction of a chart's track that 20px was of the old
 * fixed-px charts' assumed ~300-380px max height. */
const MIN_SEGMENT_LABEL_PERCENT = 6;

/** Brightness lift for the highlighted column — set as a style rather than
 * `hover:` so keyboard focus and touch highlights get it too. */
const HIGHLIGHT_FILTER = "brightness(1.25)";

export { COLUMN_WIDTH_CLASS, ICON_SIZE_CLASS, MIN_SEGMENT_LABEL_HEIGHT, MIN_SEGMENT_LABEL_PERCENT, HIGHLIGHT_FILTER };
