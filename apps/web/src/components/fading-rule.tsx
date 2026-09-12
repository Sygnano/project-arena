import { cn } from "cn";

type Props = {
  /** Extra classes on the rule itself — e.g. `flex-1` to fill the remaining
   * width of a flex row (the common case, so it's the default). */
  className?: string;
};

/**
 * The hairline gold rule that fades out to the right, used to separate a
 * panel header's caption from whatever sits at the row's other end (a
 * toggle, a legend, a mode caption). Pulled out once the same
 * `linear-gradient(90deg, rgba(200,170,110,.28), transparent)` div started
 * showing up standalone in every new panel header (Champion Picks, Banned
 * Champions, Placement, Damage) — `HextechPanel`'s own top-edge rule is a
 * different, two-sided fade and stays separate from this one.
 */
function FadingRule({ className }: Props) {
  return (
    <div
      className={cn("h-px flex-1", className)}
      style={{
        background:
          "linear-gradient(90deg, rgba(200,170,110,.28), transparent)",
      }}
    />
  );
}

export { FadingRule };
