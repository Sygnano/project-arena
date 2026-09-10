type Props = {
  /** Must be unique across the whole page, not just this component instance
   * — see `PrismaticGradientDef`'s doc comment for why. */
  id: string;
  /** Whether the bar brightens from solid gold at the base to a warm glow at
   * the top edge. Default `false` (flat solid gold) — a chart with several
   * gold bars side by side (the placement funnel, TeamSlot) reads as busy
   * with every one of them glowing at once, but PositionsChart's single
   * isolated gold bars per stage look good with it — pass `true` there. The
   * glow color (`rgb(255, 190, 140)`) is pixel-sampled from the real
   * `augmentcard_sheenglow_gold.png` texture's glow halo (see
   * `--gradient-augment-sheen-gold`'s doc comment in `globals.css` for the
   * measurement) rather than guessed — noticeably more orange than a plain
   * lightened gold would be. */
  glow?: boolean;
};

/**
 * Arena's "Gold" augment-rarity fill for chart bars — since SVG `fill` can't
 * take a CSS `background-image`, this is the bar-chart equivalent of
 * `.augment-frame-gold`'s metal ramp in `globals.css`, minus the animated
 * sheen sweep (a moving highlight reads fine on a small icon border but was
 * a distracting flicker across a whole chart's worth of bars — see git
 * history). `x1/y1/x2/y2` are in the default `objectBoundingBox` units, so
 * `(0,1)→(0,0)` always points from a bar's own bottom to its own top
 * regardless of that bar's height. Renders nothing visible by itself (a
 * zero-size hidden `<svg>` — position in the DOM doesn't matter): render
 * this once per unique `id` anywhere in the consuming chart's own tree, then
 * use `goldGradientFill(id)` as that bar's `fill`/`colors` value.
 */
function GoldGradientDef({ id, glow = false }: Props) {
  return (
    <svg aria-hidden className="absolute size-0 overflow-hidden">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--color-lol-gold-400)" />
          <stop offset={glow ? "60%" : "100%"} stopColor="var(--color-lol-gold-400)" />
          {glow ? <stop offset="100%" stopColor="#ffbe8c" /> : null}
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The `fill`/`colors` value for a bar using `<GoldGradientDef id={id} />` — `id` must be the exact same string passed to that component. */
function goldGradientFill(id: string): string {
  return `url(#${id})`;
}

export { GoldGradientDef, goldGradientFill };
