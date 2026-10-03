import { cn } from "cn";
import type { ReactNode } from "react";
import { Appear } from "@/components/appear";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

/** A line of flavor text under a story slide's title. */
function StoryText({ children, delay = 0.6, className }: Props) {
  return (
    <Appear delay={delay}>
      <p
        className={cn(
          "mt-4 max-w-xl text-[clamp(15px,1.5vw,19px)] leading-relaxed text-lol-text-secondary [text-wrap:pretty]",
          className,
        )}
      >
        {children}
      </p>
    </Appear>
  );
}

export { StoryText };
