import { cn } from "cn";

type Props = {
  /** `lg` for the splash page, `sm` for the top bar. */
  size?: "sm" | "lg";
  className?: string;
};

/**
 * The site's mark: a nested hextech diamond (gold frame, blue core) beside
 * an "ARENA / STATS" wordmark. Purely visual — wrap it in a link where it
 * should navigate.
 */
function Logo({ size = "sm", className }: Props) {
  const large = size === "lg";
  return (
    <span className={cn("inline-flex items-center", large ? "gap-4" : "gap-2.5", className)}>
      <svg
        aria-hidden
        viewBox="0 0 32 32"
        className={cn("flex-none overflow-visible", large ? "h-14 w-14" : "h-7 w-7")}
      >
        <defs>
          <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0e6d2" />
            <stop offset=".5" stopColor="#c8aa6e" />
            <stop offset="1" stopColor="#785a28" />
          </linearGradient>
          <linearGradient id="logo-core" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cdfafa" />
            <stop offset=".45" stopColor="#0ac8b9" />
            <stop offset="1" stopColor="#005a82" />
          </linearGradient>
        </defs>
        <path d="M16 1 31 16 16 31 1 16Z" fill="#050e16" stroke="url(#logo-gold)" strokeWidth="1.6" />
        <path d="M16 6.5 25.5 16 16 25.5 6.5 16Z" fill="none" stroke="#c8aa6e" strokeOpacity=".45" strokeWidth=".8" />
        <path
          d="M16 11 21 16 16 21 11 16Z"
          fill="url(#logo-core)"
          style={{ filter: "drop-shadow(0 0 3px rgba(10,200,185,.8))" }}
        />
      </svg>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-lol-gold-50",
            large ? "text-4xl tracking-[.16em] sm:text-5xl" : "text-lg tracking-[.14em]",
          )}
        >
          ARENA
        </span>
        <span
          className={cn(
            "text-lol-blue-200",
            large ? "mt-1.5 text-[13px] tracking-[.62em]" : "mt-0.5 text-[9px] tracking-[.5em]",
          )}
        >
          STATS
        </span>
      </span>
    </span>
  );
}

export { Logo };
