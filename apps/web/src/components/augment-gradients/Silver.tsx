type Props = {
  /** Must be unique across the whole page, not just this component instance
   * — see `PrismaticGradientDef`'s doc comment for why. */
  id: string;
  /** Whether the bar brightens from solid silver at the base to a white glow
   * at the top edge. Default `false` — see `GoldGradientDef`'s doc comment
   * for the full rationale (same technique, same reasoning on which charts
   * want it on vs. off). The glow color is pure white (`rgb(255, 255, 255)`),
   * pixel-sampled from the real `augmentcard_sheenglow_silver.png` texture's
   * glow halo — see `--gradient-augment-sheen-silver`'s doc comment in
   * `globals.css`. */
  glow?: boolean;
};

/**
 * Arena's "Silver" augment-rarity fill for chart bars — see
 * `GoldGradientDef`'s doc comment for the full rationale (same technique).
 */
function SilverGradientDef({ id, glow = false }: Props) {
  return (
    <svg aria-hidden className="absolute size-0 overflow-hidden">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--color-augment-silver)" />
          <stop offset={glow ? "60%" : "100%"} stopColor="var(--color-augment-silver)" />
          {glow ? <stop offset="100%" stopColor="#ffffff" /> : null}
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The `fill`/`colors` value for a bar using `<SilverGradientDef id={id} />` — `id` must be the exact same string passed to that component. */
function silverGradientFill(id: string): string {
  return `url(#${id})`;
}

export { SilverGradientDef, silverGradientFill };
