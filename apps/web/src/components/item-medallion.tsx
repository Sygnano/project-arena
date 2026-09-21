import { cn } from "cn";

type Props = {
  iconUrl: string;
  alt: string;
  /** Outer diameter: a px number, or any CSS length (e.g. a `clamp()`) for
   * a diameter that tracks the viewport. Every inset scales from the 172px
   * original. */
  size?: number | string;
  /** Opacity of the gold bloom around the art plate. */
  glow?: number;
  className?: string;
};

/**
 * Square item art shown as a rotated diamond: a slow dashed spin ring, a
 * counter-rotating diamond frame with two gold markers, and the art plate.
 *
 * The art is a 141%-sized, counter-rotated `<img loading="lazy" decoding="async">` so it fills the diamond
 * edge to edge. It needs `max-w-none`: Tailwind's preflight caps every
 * `<img loading="lazy" decoding="async">` at `max-width: 100%`, which silently clamps the width (but not the
 * explicit height) and leaves the art squashed and shifted to one side.
 */
function ItemMedallion({ iconUrl, alt, size = 172, glow = 0.16, className }: Props) {
  const diameter = typeof size === "number" ? `${size}px` : size;
  // Insets are expressed as a fraction of the diameter rather than resolved
  // numbers, so a fluid `size` stays proportional at every viewport.
  const scaled = (px: number) => `calc(${diameter} * ${px / 172})`;
  return (
    <div
      className={cn("relative flex-none", className)}
      style={{ width: diameter, height: diameter }}
    >
      <div className="welcome-spin-slow absolute inset-0 rounded-full border border-dashed border-[rgba(200,170,110,.38)]" />
      <div className="welcome-spin-reverse absolute" style={{ inset: scaled(16) }}>
        <div className="absolute inset-0 rotate-45 border border-[rgba(200,170,110,.45)]" />
        <div className="absolute top-[-4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-lol-gold-300" />
        <div className="absolute bottom-[-4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-lol-gold-300" />
      </div>
      <div
        className="absolute rotate-45 overflow-hidden border border-[rgba(200,170,110,.7)]"
        style={{ inset: scaled(30), boxShadow: `0 0 ${scaled(50)} rgba(200,170,110,${glow})` }}
      >
        <img
          loading="lazy"
          decoding="async"
          src={iconUrl}
          alt={alt}
          className="absolute top-[-20.5%] left-[-20.5%] h-[141%] w-[141%] max-w-none -rotate-45 object-cover"
        />
      </div>
    </div>
  );
}

export { ItemMedallion };
