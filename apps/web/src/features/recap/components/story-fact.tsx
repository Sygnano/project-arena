import { cn } from "cn";
import type { ReactNode } from "react";
import { Appear } from "@/components/appear";

type Props = {
  label: string;
  children: ReactNode;
  /** A small square icon (champion, crest, item) before the text. */
  iconUrl?: string | null;
  /** Rounded icon (champion portraits) instead of a diamond-framed one. */
  roundIcon?: boolean;
  delay?: number;
  className?: string;
};

/** One side fact on a story slide: a small caps label over one short line. */
function StoryFact({ label, children, iconUrl, roundIcon = false, delay = 1, className }: Props) {
  return (
    <Appear delay={delay} className={cn("min-w-0", className)}>
      <div className="flex h-full items-center gap-3 border-l border-[rgba(200,170,110,.35)] bg-[linear-gradient(90deg,rgba(4,12,20,.6),transparent)] py-2 pr-3 pl-3.5">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            width={36}
            height={36}
            className={cn(
              "size-8 flex-none object-cover sm:size-9",
              roundIcon ? "rounded-full border border-[rgba(200,170,110,.5)]" : "",
            )}
          />
        ) : null}
        <div className="min-w-0">
          <div className="truncate text-[9.5px] tracking-[.3em] text-lol-text-muted sm:text-[10px]">{label}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-lol-gold-50 sm:text-[15px]">{children}</div>
        </div>
      </div>
    </Appear>
  );
}

export { StoryFact };
