type Props = {
  /** Must be unique across the whole page, not just this component instance.
   * Arena Stats renders every category section on one long scrolling page at
   * once (see `SummonerStatsView`), so more than one chart using this
   * gradient can easily be mounted simultaneously — a shared/default id
   * would mean two `<linearGradient>` elements fighting over the same id in
   * the DOM, which is invalid HTML with undefined `url(#id)` resolution.
   * Pick something namespaced to the calling chart, e.g.
   * `"positions-chart-prismatic-fill"`. */
  id: string;
  /** Whether the pink→violet→blue→green→pink loop cycles over time. Default
   * `true`. A moving highlight reads fine on an isolated shape (a bar chart's
   * single 1st-place bar) but some charts (the placement funnel) render
   * every stage's fill at once and read as busier with it moving — pass
   * `false` there for the same static diagonal gradient frozen on its first
   * frame, no `<animateTransform>`. */
  animate?: boolean;
};

/**
 * Arena's animated "Prismatic" augment-rarity gradient, as an SVG fill for
 * chart bars (or any other SVG shape) — the SVG equivalent of
 * `.augment-frame-prismatic`'s CSS border animation in `globals.css`, since
 * SVG `fill` can't take a CSS `background-image`. Renders nothing visible by
 * itself (a zero-size hidden `<svg>` — position in the DOM doesn't matter):
 * render this once per unique `id` anywhere in the consuming chart's own
 * tree, then use `prismaticGradientFill(id)` as that bar's `fill`/`colors`
 * value.
 *
 * `spreadMethod="repeat"` tiles the pink→violet→blue→green→pink loop
 * endlessly along the gradient's own axis, i.e. the (x1,y1)→(x2,y2) vector —
 * here (0,0)→(1,1), a diagonal. For the loop to be seamless,
 * `animateTransform` must slide it by exactly that same vector (one full
 * tile) per cycle: sliding by anything else (e.g. a horizontal-only (1,0)
 * against a diagonal (1,1) axis) desyncs the tile from its own repeat
 * direction, which is invisible mid-animation but shows up as a hard jump at
 * the loop seam.
 */
function PrismaticGradientDef({ id, animate = true }: Props) {
  return (
    <svg aria-hidden className="absolute size-0 overflow-hidden">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1" spreadMethod="repeat">
          <stop offset="0%" stopColor="var(--color-augment-prismatic-pink)" />
          <stop offset="25%" stopColor="var(--color-augment-prismatic-violet)" />
          <stop offset="50%" stopColor="var(--color-augment-prismatic-blue)" />
          <stop offset="75%" stopColor="var(--color-augment-prismatic-green)" />
          <stop offset="100%" stopColor="var(--color-augment-prismatic-pink)" />
          {animate ? (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-1 -1"
              to="0 0"
              dur="6s"
              repeatCount="indefinite"
            />
          ) : null}
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The `fill`/`colors` value for a bar using `<PrismaticGradientDef id={id} />` — `id` must be the exact same string passed to that component. */
function prismaticGradientFill(id: string): string {
  return `url(#${id})`;
}

export { PrismaticGradientDef, prismaticGradientFill };
