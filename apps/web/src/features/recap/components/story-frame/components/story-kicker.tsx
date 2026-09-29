import type { ReactNode } from "react";
import { cn } from "cn";
import { Appear } from "@/components/appear";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

/** The small gold caps line above a story slide's title. */
function StoryKicker({ children, delay = 0.1, className }: Props) {
  return (
    <Appear delay={delay}>
      <p
        className={cn(
          "flex items-center gap-3 text-[11px] tracking-[.42em] text-lol-gold-300 sm:text-[12px]",
          className,
        )}
      >
        <span aria-hidden className="block h-2 w-2 rotate-45 border border-lol-gold-300" />
        {children}
      </p>
    </Appear>
  );
}

export { StoryKicker };
