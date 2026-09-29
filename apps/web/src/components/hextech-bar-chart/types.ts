import type { ReactNode } from "react";

/**
 * One slice of a column's bar. A single-segment column (KDA: one bar per
 * champion) just passes a 1-element array; a stacked column (TeamSlot:
 * placement-tier breakdown per team) passes several.
 *
 * Segments are given TOP-TO-BOTTOM — the first element is the topmost
 * slice of the stack, rendered immediately under the cap diamond — which is
 * the reverse of how a stacking convention like nivo's `keys` (bottom-up)
 * usually reads. This is deliberate: with `flex-direction: column` and
 * `justify-content: flex-end` (how the column packs itself against its own
 * baseline), children keep their DOM order top-to-bottom regardless of
 * `justify-content`, so "first element in the array" and "first element in
 * the DOM" being the same thing means "top of the stack" for both.
 */
type BarSegment = {
  /** React key within the column only — never displayed. */
  key: string;
  /** Height in px (the chart's default `heightUnit`), or a percentage
   * (0-100) of the column's own bar track when the chart is passed
   * `heightUnit="percent"` — see that prop's doc comment for why a chart
   * would want one over the other. */
  height: number;
  /** Pre-formatted value shown centered inside the segment — but only when
   * the segment is tall enough to actually fit it (see
   * `MIN_SEGMENT_LABEL_HEIGHT`/`MIN_SEGMENT_LABEL_PERCENT`); silently
   * dropped otherwise rather than overflowing into a neighboring segment.
   * Put the exact value in `title` too, so it's still reachable on hover
   * even when the in-segment label gets dropped. */
  label?: string;
  /** Native tooltip text (e.g. "3 1st-place finishes"), the always-available
   * fallback for whatever a dropped in-segment `label` would have said. */
  title?: string;
  /** Exactly one of these two should be set: `fillClassName` for one of the
   * animated tier gradients (`tier-bar-prismatic` / `-gold` / `-silver`, see
   * globals.css) shared by every stacked-rarity bar in the app, or
   * `background` for a plain CSS gradient string (KDA's cyan
   * "leader"/"rest" fill, which isn't a fixed rarity tier). */
  fillClassName?: string;
  background?: string;
  /** The segment's own `border-top` color — still needed even when the fill
   * comes from `fillClassName`, since an unset `border-top` color would
   * default to black against these bright fills. */
  borderColor: string;
  /** Only honored on a plain `background` segment. Tier-filled segments
   * never glow individually: in a stack, three differently-colored halos
   * overlapped each other and bled past the slice edges, so the chart gives
   * the whole bar one soft glow instead (see `barGlow`). */
  boxShadow?: string;
};

type BarColumn = {
  /** Stable id — used as the React key and passed back to `onSelect`. */
  id: string | number;
  /** Bottom-up value first, see `BarSegment`'s doc comment for why the
   * array itself is top-to-bottom. */
  segments: BarSegment[];
  /** Value shown above the stack's peak — KDA's per-champion metric value,
   * or a stacked bar's grand total (nivo's `enableTotals`, generalized). */
  topLabel?: string;
  /** Any JSX element rendered in the icon slot (img, SVG, etc.) —
   * the slot is 36×36 px. When omitted, `fallbackLabel` is shown instead. */
  icon?: ReactNode;
  /** Shown in place of `icon` when it's omitted (e.g. an unmapped team
   * crest) — short text, not a full label; the icon slot is only 36px. */
  fallbackLabel?: string;
  /** Brightest cyan cap + number, independent of `isSelected` — a column
   * can be the leader, selected, both, or neither. */
  isLeader?: boolean;
  isSelected?: boolean;
  /** Spoken name for the column's select button (e.g. "Samira, 42 games").
   * Needed for keyboard/screen-reader users whenever `onSelect` is set. */
  ariaLabel?: string;
  /** Fades the column — used for a rate-sorted column whose sample is too
   * small to trust (see `features/recap/utils/sample.ts`). */
  dimmed?: boolean;
};

type HoverPoint = { x: number; y: number };

export type { BarSegment, BarColumn, HoverPoint };
