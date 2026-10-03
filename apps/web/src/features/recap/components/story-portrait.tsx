import { cn } from "cn";
import type { ReactNode } from "react";
import { Appear } from "@/components/appear";
import { championLoadingUrl } from "@/utils/riot";

type Props = {
  /** Riot's champion key, for the art. */
  championName: string;
  /** Small caps line over the name ("YOUR #1", "EXECUTIONER"). */
  label: string;
  /** The display name. */
  name: string;
  /** One short line under the name ("577 kills"). */
  stat?: ReactNode;
  /** Pinned to the card's corner, e.g. an ability key. */
  badge?: ReactNode;
  /** Border and glow color, as "r,g,b". */
  glow?: string;
  delay?: number;
  /** Sets the card's height (its width follows the art's 308:560 ratio). */
  className?: string;
};

/**
 * A champion's full loading-screen portrait as a card, for a story slide's
 * featured champion: the art fills it, the label, name and stat sit on a
 * dark fade at the bottom.
 */
function StoryPortrait({
  championName,
  label,
  name,
  stat,
  badge,
  glow = "200,170,110",
  delay = 0.3,
  className,
}: Props) {
  return (
    <Appear from="scale" delay={delay} className="flex-none">
      <div
        className={cn("relative h-[clamp(160px,40vh,440px)]", className)}
        style={{ aspectRatio: "308 / 560", boxShadow: `0 0 48px rgba(${glow},.35)` }}
      >
        <img
          src={championLoadingUrl(championName)}
          alt=""
          className="size-full border object-cover"
          style={{ borderColor: `rgba(${glow},.65)` }}
        />
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(transparent,rgba(1,5,10,.92)_45%)] px-2 pt-12 pb-3 text-center">
          <div className="text-[9px] tracking-[.3em] text-lol-gold-300 sm:text-[10px]">{label}</div>
          <div className="mt-1 font-display text-[clamp(14px,1.7vw,22px)] leading-tight tracking-[.05em] text-lol-gold-50">
            {name.toUpperCase()}
          </div>
          {stat ? <div className="mt-0.5 text-[11px] text-lol-text-secondary sm:text-[13px]">{stat}</div> : null}
        </div>
        {badge ? <div className="absolute -top-3 -right-3">{badge}</div> : null}
      </div>
    </Appear>
  );
}

export { StoryPortrait };
