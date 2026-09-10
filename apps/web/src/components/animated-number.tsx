"use client";

import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";
import { useInView } from "@/hooks/use-in-view";

interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
  /** Formats the in-flight animated value every frame. Overrides `decimals`
   * entirely if provided. */
  format?: (value: number) => string;
  /** Decimal places for the default formatter (e.g. 2 for a KDA like
   * "2.62"). Ignored if `format` is provided. Defaults to 0 — a plain,
   * comma-grouped integer. */
  decimals?: number;
  className?: string;
}

/**
 * Just the typography — a number that counts up to `value`, nothing else.
 * `AnimatedStat` composes this into a titled card; use this one directly
 * for an animated number anywhere outside that card shape (inline in text,
 * a custom layout, etc).
 */
export function AnimatedNumber({
  value,
  durationMs = 1200,
  format,
  decimals = 0,
  className,
}: AnimatedNumberProps) {
  const [ref, isInView] = useInView<HTMLSpanElement>({ threshold: 0.3 });
  const animated = useCountUp(value, durationMs, isInView);
  // Locale pinned to "en-US" rather than left to the viewer's browser:
  // this is a Client Component that Next.js still server-renders for the
  // initial paint, so an unpinned locale can mismatch between the server's
  // locale and the browser's on hydration — and even without that, a
  // shared stats site showing "2,63" to one friend and "2.63" to another
  // for the same value is its own kind of confusing.
  const display = format
    ? format(animated)
    : animated.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {display}
    </span>
  );
}
