"use client";

import { useState, type ReactNode } from "react";
import { motion, MotionConfig } from "motion/react";
import { cn } from "cn";

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
export type BarSegment = {
  /** React key within the column only — never displayed. */
  key: string;
  /** Height in px. */
  height: number;
  /** Pre-formatted value shown centered inside the segment — but only when
   * the segment is tall enough to actually fit it (see
   * `MIN_SEGMENT_LABEL_HEIGHT`); silently dropped otherwise rather than
   * overflowing into a neighboring segment. Put the exact value in `title`
   * too, so it's still reachable on hover even when the in-segment label
   * gets dropped. */
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
  boxShadow?: string;
};

export type BarColumn = {
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
};

type Props = {
  columns: BarColumn[];
  /** Omit for a non-interactive chart (no cursor, no click handler) — e.g.
   * TeamSlot, which doesn't have a per-column detail view to drive. */
  onSelect?: (id: string | number) => void;
  /** Centers columns instead of left-aligning them when they don't fill the
   * available width. Off by default to match KDA's many-champion
   * horizontal scroller (nothing to center against once it overflows); turn
   * on for a chart with a small, fixed column count that's meant to sit
   * centered in its panel (e.g. TeamSlot's 6 teams). */
  center?: boolean;
  /** Makes columns share the container width equally (`flex: 1 1 0%` on
   * every column, in BOTH rows) instead of each sitting at a fixed
   * `COLUMN_WIDTH_CLASS`. Since the bar row and the icon row are two
   * separate flex containers, they only end up with matching column widths
   * — bars lining up over their own icon — when neither row's width
   * depends on that column's own content (a team's icon+name is a
   * different width than its number label). `min-w-0` alongside `flex-1` is
   * what actually achieves that: it drops each column's content width from
   * the flex-basis calculation, so both rows independently divide the same
   * container width into the same N equal shares. */
  fluid?: boolean;
  /** Gap between columns, in px. Defaults to 16 (KDA's original spacing);
   * pass a bigger value for a chart with few, wide columns that should read
   * as more deliberately spaced out (e.g. TeamSlot). */
  gap?: number;
  /** Fixed column width in px, overriding the default 54px (`w-13.5`) —
   * e.g. Champion Picks' denser 20-column chart uses 26px columns. Ignored
   * when `fluid` is set (columns share the container width instead). */
  columnWidth?: number;
  /** The rotated-diamond cap between a column's `topLabel` and its bar —
   * KDA/TeamSlot's cyan "leader" marker. Champion Picks has no cap at all
   * (its selection state is carried by the lift + ring below instead), so
   * `"none"` skips rendering it entirely rather than rendering an
   * always-dim one. */
  capStyle?: "diamond" | "none";
  /** How a selected column reads: `"brightness"` (default, KDA/TeamSlot —
   * a hover/selected brightness filter) or `"lift"` (Champion Picks — the
   * whole column rises `translateY(-7px)` and gains a 1px gold ring, with no
   * brightness change). */
  selectionStyle?: "brightness" | "lift";
  /** Overrides the built-in `isLeader`-based cyan/muted `topLabel` color —
   * e.g. Champion Picks colors its total-picks label by `isSelected`
   * instead (it has no "leader" cap to match colors with). */
  topLabelColor?: (column: BarColumn) => string;
  /** Arbitrary content absolutely-positioned over the bar row itself (not
   * the icon strip below it) — e.g. Champion Picks' dashed season-average
   * line or Placement's cumulative-count polyline. Position children with
   * `bottom` (the row's bottom edge is always the bar baseline, i.e. the
   * `border-b` line) rather than `top`, since the row's own height tracks
   * its flex container, not a fixed plot height. Defaults to
   * `pointer-events-none` on the wrapper only — an interactive child can
   * still opt back in with its own `pointer-events: auto`. */
  plotOverlay?: ReactNode;
};

const COLUMN_WIDTH_CLASS = "w-13.5";
const ICON_SIZE_CLASS = "size-9";

/** Below this, a segment's own height can't fit a legible number without
 * either clipping or bleeding into the segment above/below it — the label
 * is dropped rather than shrunk further, since an unreadably tiny number is
 * worse than no number (the segment's `title` still carries the exact value
 * on hover). ~20px comfortably fits the 12px label used below. */
const MIN_SEGMENT_LABEL_HEIGHT = 20;

/**
 * The Hextech "instrument panel" bar chart — a horizontally-scrolling,
 * per-column bar chart with an icon strip underneath, shared by every
 * section that needs this exact visual language (first built bespoke for
 * KDA, see `design_handoff_arena_kda/README.md`, "Chart (horizontal
 * scroller)"; lifted here once TeamSlot needed the same treatment for a
 * stacked variant). Both rows live in the same `overflow-x-auto` wrapper so
 * they scroll together as a single unit.
 *
 * The two rows deliberately reorder differently on a re-sort (e.g. KDA's
 * metric/mode change): the icon row is keyed by `column.id` and uses
 * Motion's `layout="position"` FLIP animation to slide each icon sideways
 * into its new rank — `"position"` rather than the default `layout={true}`
 * so Motion only interpolates position via `transform`, never scale (scaling
 * a bordered/glowing element to fake a size change would visibly distort its
 * border width and box-shadow spread). The bar row is keyed by slot INDEX
 * instead, not `column.id` — bars never slide sideways at all, since there's
 * always the same fixed number of rank slots; a re-sort just changes which
 * champion's data now renders in a given slot, and that slot's bar tweens
 * from its old height to the new one in place via a plain CSS `transition`
 * on the segment. This split was deliberate, not an oversight: animating a
 * bar's height (a layout-triggering property) at the same time Motion is
 * also sliding that same element sideways (a `transform`) read as janky —
 * two different animation systems (browser CSS transition vs. Motion's RAF
 * loop) fighting over the same element's frame timing — so bars now only
 * ever move vertically in place, and only the icon row (which never changes
 * size, only position) does the horizontal FLIP. Since old/new bar heights
 * here are always concrete pixel numbers (never `auto`), CSS can't spring,
 * but a "back ease" cubic-bezier (small overshoot past the target then
 * settle) reads as the same elasticity as the icon row's spring, so the two
 * stay visually consistent despite using different techniques.
 */
function HextechBarChart({
  columns,
  onSelect,
  center = false,
  fluid = false,
  gap = 16,
  columnWidth,
  capStyle = "diamond",
  selectionStyle = "brightness",
  topLabelColor,
  plotOverlay,
}: Props) {
  const gapStyle = { gap: `${gap}px` };
  const columnWidthStyle =
    !fluid && columnWidth ? { width: columnWidth } : undefined;

  // Which icons are mid-FLIP right now, purely to drive the `.hex-move-glow`
  // one-shot flash (see globals.css) — set/cleared by that icon's own
  // `onLayoutAnimationStart`/`Complete` below.
  const [movingIds, setMovingIds] = useState<Set<string | number>>(
    () => new Set(),
  );
  const startMoving = (id: string | number) =>
    setMovingIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  const stopMoving = (id: string | number) =>
    setMovingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  return (
    <MotionConfig
      transition={{ type: "spring", stiffness: 450, damping: 25, mass: 0.8 }}
    >
      <motion.div
        layoutScroll
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-auto overflow-y-hidden",
        )}
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(200,170,110,.45) transparent",
        }}
      >
        <div
          className={cn(
            "relative flex min-h-0 flex-1 items-end border-b border-[rgba(200,170,110,.3)] px-0.5",
            fluid ? "w-full" : "min-w-full w-max",
            center && "justify-center",
          )}
          style={gapStyle}
        >
          {plotOverlay ? (
            <div className="pointer-events-none absolute inset-0">
              {plotOverlay}
            </div>
          ) : null}
          {columns.map((column, index) => (
            <div
              // Keyed by slot position, not `column.id`: bars never reorder
              // themselves (there's always the same number of them, just
              // fixed rank slots) — only the icon row below reorders to show
              // which champion now occupies which slot. Keying by index
              // means React reuses the same DOM node for a given slot across
              // a re-sort, so a bar's height just tweens to its new value in
              // place via the CSS transition on its segment, instead of
              // Motion's `layout="position"` FLIP sliding the whole bar
              // sideways at the same time a height transition is also
              // playing on it.
              key={index}
              onClick={onSelect ? () => onSelect(column.id) : undefined}
              className={cn(
                "flex flex-col items-center justify-end gap-2 transition-[filter,transform,box-shadow] duration-150",
                fluid
                  ? "min-w-0 flex-1"
                  : cn(!columnWidth && COLUMN_WIDTH_CLASS, "flex-none"),
                onSelect &&
                  selectionStyle === "brightness" &&
                  "cursor-pointer hover:brightness-125",
                onSelect && selectionStyle === "lift" && "cursor-pointer",
              )}
              style={{
                ...columnWidthStyle,
                ...(selectionStyle === "lift" && column.isSelected
                  ? {
                      transform: "translateY(-7px)",
                      boxShadow: "0 0 0 1px rgba(200,170,110,.85)",
                    }
                  : undefined),
              }}
            >
              {column.topLabel ? (
                <div
                  className="font-display text-[19px]"
                  style={{
                    color:
                      topLabelColor?.(column) ??
                      (column.isLeader
                        ? "#e6fffb"
                        : "var(--color-lol-text-secondary)"),
                  }}
                >
                  {column.topLabel}
                </div>
              ) : null}

              {capStyle === "diamond" ? (
                <div
                  className="h-2.75 w-2.75 rotate-45 border"
                  style={{
                    background: column.isLeader ? "#e6fffb" : "#0b1620",
                    borderColor: column.isLeader
                      ? "#e6fffb"
                      : "rgba(10,200,185,.75)",
                    boxShadow: column.isLeader
                      ? "0 0 22px rgba(10,224,207,.65)"
                      : "none",
                  }}
                />
              ) : null}

              <div
                className={cn("w-full items-center justify-center overflow-hidden border-t")}
              >
                {column.segments.map((segment) => (
                  <div
                    key={segment.key}
                    title={segment.title}
                    className={cn(
                      "flex w-full items-center justify-center transition-[height] duration-450 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                      segment.fillClassName,
                    )}
                    style={{
                      height: segment.height,
                      background: segment.background,
                      borderColor: segment.borderColor,
                      boxShadow: segment.boxShadow,
                    }}
                  >
                    {segment.label &&
                    segment.height >= MIN_SEGMENT_LABEL_HEIGHT ? (
                      <span
                        className="font-display text-[12px] leading-none text-[#040c14]"
                        style={{
                          textShadow:
                            "0 0 3px rgba(240,230,210,.9), 0 0 3px rgba(240,230,210,.9)",
                        }}
                      >
                        {segment.label}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className={cn(
            "flex px-0.5 pt-3 pb-3",
            fluid ? "w-full" : "min-w-full w-max",
            center && "justify-center",
          )}
          style={gapStyle}
        >
          {columns.map((column) => {
            const iconEdge = column.isSelected
              ? "var(--color-lol-gold-300)"
              : column.isLeader
                ? "rgba(10,224,207,.8)"
                : "rgba(200,170,110,.22)";
            return (
              <motion.div
                key={column.id}
                layout="position"
                onLayoutAnimationStart={() => startMoving(column.id)}
                onLayoutAnimationComplete={() => stopMoving(column.id)}
                onClick={onSelect ? () => onSelect(column.id) : undefined}
                className={cn(
                  "group flex flex-col items-center gap-1.25 transition-[filter] duration-150",
                  fluid
                    ? "min-w-0 flex-1"
                    : cn(!columnWidth && COLUMN_WIDTH_CLASS, "flex-none"),
                  onSelect && "cursor-pointer hover:brightness-125",
                  movingIds.has(column.id) && "hex-move-glow",
                )}
                style={columnWidthStyle}
              >
                {column.icon ? (
                  <div
                    className={cn("flex items-center justify-center")}
                    style={{ borderColor: iconEdge }}
                  >
                    {column.icon}
                  </div>
                ) : (
                  <div
                    className={cn(
                      ICON_SIZE_CLASS,
                      "flex items-center justify-center text-center text-[9px] leading-none text-lol-text-muted",
                    )}
                    style={{ borderColor: iconEdge }}
                  >
                    {column.fallbackLabel}
                  </div>
                )}
                <div
                  className={
                    column.isSelected
                      ? "h-1.75 w-1.75 rotate-45 bg-lol-gold-300 opacity-100"
                      : cn(
                          "h-1.75 w-1.75 rotate-45 bg-lol-gold-300 opacity-0 transition-opacity duration-150",
                          onSelect && "group-hover:opacity-40",
                        )
                  }
                />
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </MotionConfig>
  );
}

export { HextechBarChart };
