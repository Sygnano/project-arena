import { cn } from "cn";

type Props = {
  /** The numeric value displayed in the center. */
  value: number;
  /** Label shown below the value (e.g. "KDA", "AVG"). */
  label: string;
  /** Optional format function — defaults to `value.toFixed(2)`. */
  formatValue?: (value: number) => string;
  /** Additional classes on the outermost wrapper. */
  className?: string;
};

/**
 * A circular dial gauge — two concentric hairline circles, a spinning
 * double-arc SVG, two breathing gold diamonds at top and bottom, and a
 * value + label centered inside. Reusable across any section that needs
 * this "hextech instrument" ring.
 */
function Dial({ value, label, formatValue, className }: Props) {
  return (
    <div
      className={cn(
        "relative mx-auto mt-11 flex h-[286px] w-[286px] items-center justify-center",
        className,
      )}
    >
      <div className="absolute inset-8 rounded-full border border-[rgba(200,170,110,.55)]" />
      <div className="absolute inset-5 rounded-full border border-[rgba(10,200,185,.16)]" />
      <svg
        viewBox="0 0 286 286"
        className="dial-spin absolute inset-0 h-full w-full"
      >
        <circle
          cx="143"
          cy="143"
          r="122"
          fill="none"
          stroke="var(--color-lol-blue-400)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="144 622"
          opacity=".9"
          style={{ filter: "drop-shadow(0 0 8px rgba(10,196,217,.9))" }}
        />
        <circle
          cx="143"
          cy="143"
          r="122"
          fill="none"
          stroke="var(--color-lol-blue-300)"
          strokeWidth="1"
          strokeDasharray="38 728"
          strokeDashoffset="-290"
          opacity=".5"
        />
      </svg>
      <div className="dial-breathe absolute top-[-2px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-lol-gold-300" />
      <div
        className="dial-breathe absolute bottom-[-2px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-lol-gold-300"
        style={{ animationDelay: "2.5s" }}
      />
      <div className="text-center">
        <div
          className="font-display text-[72px] leading-none text-lol-gold-50"
          style={{ textShadow: "0 0 26px rgba(10,200,185,.35)" }}
        >
          {formatValue ? formatValue(value) : value.toFixed(2)}
        </div>
        <div className="mt-1.5 pl-[.42em] text-sm tracking-[.42em] text-lol-blue-300">
          {label}
        </div>
      </div>
    </div>
  );
}

export { Dial };
