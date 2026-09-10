import { Fragment } from "react";
import { AnimatedNumber } from "@/components/animated-number";
import { cn } from "cn";

type Props = {
  stats: ReadonlyArray<readonly [label: string, value: number]>;
  className?: string;
};

/** A label/value grid of animated numbers — the shared layout behind Kills,
 * Utility, Fun, and the stat half of Economy. */
const StatGrid = ({ stats, className }: Props) => (
  <div className={cn("grid grid-cols-2 gap-x-16 gap-y-4", className)}>
    {stats.map(([label, value]) => (
      <Fragment key={label}>
        <span className="text-lol-text-muted">{label}</span>
        <AnimatedNumber
          value={value}
          className="justify-self-end font-display text-2xl font-semibold text-lol-gold-50"
        />
      </Fragment>
    ))}
  </div>
);

export { StatGrid };
