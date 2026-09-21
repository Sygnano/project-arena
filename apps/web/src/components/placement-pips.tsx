import { cn } from "cn";
import { ordinal } from "@/lib/format";

/**
 * A row of recent placements, newest first — one small diamond per game in
 * the page's fixed outcome colors (1st prismatic, 2nd–3rd gold, 4th+
 * silver), with the ordinal inside. Answers "how am I doing lately?" at a
 * glance, and is announced to screen readers as a plain list of placements.
 */
function PlacementPips({
  placements,
  className,
  size = "md",
  ariaLabel,
}: {
  placements: readonly number[];
  className?: string;
  /** `sm` fits a hover card (a day can hold a dozen games). */
  size?: "sm" | "md";
  /** Overrides the default "newest first" announcement for another order. */
  ariaLabel?: string;
}) {
  if (placements.length === 0) return null;
  return (
    <ol
      aria-label={ariaLabel ?? `Last ${placements.length} placements, newest first: ${placements.map(ordinal).join(", ")}`}
      className={cn("flex flex-wrap items-center justify-center", className)}
    >
      {placements.map((placement, index) => {
        const tone =
          placement === 1
            ? "border-[#f5eaff] text-[#f5eaff] shadow-[0_0_12px_rgba(185,138,221,.55)] bg-[rgba(185,138,221,.18)]"
            : placement <= 3
              ? "border-lol-gold-300 text-lol-gold-50 shadow-[0_0_10px_rgba(200,155,60,.35)] bg-[rgba(200,155,60,.12)]"
              : "border-[rgba(185,196,200,.45)] text-lol-text-muted bg-[rgba(5,14,22,.6)]";
        return (
          // A rotated square's layout box stays its unrotated size, so the
          // slot is sized to the diamond's diagonal (side × √2): with no gap,
          // neighbouring diamonds meet exactly tip to tip.
          <li
            key={index}
            aria-hidden
            className={cn(
              "flex items-center justify-center",
              size === "sm" ? "h-[1.76777rem] w-[1.76777rem]" : "h-[2.82842rem] w-[2.82842rem]",
            )}
          >
            <div
              className={cn(
                "flex rotate-45 items-center justify-center border",
                size === "sm" ? "h-5 w-5" : "h-8 w-8",
                tone,
              )}
            >
              <span
                className={cn(
                  "-rotate-45 font-display leading-none",
                  size === "sm" ? "text-[10px]" : "text-[12px]",
                )}
              >
                {placement}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { PlacementPips };
