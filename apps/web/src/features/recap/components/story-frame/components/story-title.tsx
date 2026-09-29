import type { ReactNode } from "react";
import { cn } from "cn";
import { Appear } from "@/components/appear";

type Props = {
  /** The slide's accessible name (`StoryFrame`'s `labelledBy`). */
  id: string;
  children: ReactNode;
  delay?: number;
  className?: string;
};

/** A story slide's headline: big display type that leads the screen. */
function StoryTitle({ id, children, delay = 0.25, className }: Props) {
  return (
    <Appear delay={delay}>
      <h2
        id={id}
        className={cn(
          "mt-3 font-display text-[clamp(28px,4.6vw,60px)] leading-[1.04] tracking-[.03em] text-lol-gold-50 [text-wrap:balance]",
          className,
        )}
      >
        {children}
      </h2>
    </Appear>
  );
}

export { StoryTitle };
