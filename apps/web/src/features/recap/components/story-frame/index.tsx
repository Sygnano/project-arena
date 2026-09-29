"use client";

import type { ReactNode } from "react";
import { cn } from "cn";

type Props = {
  /** Background art, shown heavily blurred. */
  imageUrl: string;
  /** Two glow colors (any CSS color) washing over the art from opposite
   * corners: each slide gets its own, so the story changes mood as it goes. */
  tone: readonly [string, string];
  /** Id of the slide's title, its accessible name. */
  labelledBy: string;
  children: ReactNode;
  /** Layout of the content column (it's a flex column filling the screen). */
  className?: string;
};

/**
 * One story recap screen: blurred art, the slide's color glow and a vignette
 * behind a centered content column that clears the player's progress bar
 * and header. Fills the player exactly; content fits by scaling (clamp()
 * sizes, details dropped on short screens), never by scrolling.
 */
function StoryFrame({ imageUrl, tone, labelledBy, children, className }: Props) {
  return (
    <section aria-labelledby={labelledBy} className="absolute inset-0 overflow-hidden bg-lol-navy-950">
      <div
        aria-hidden
        className="absolute -inset-12 bg-cover bg-center"
        style={{ backgroundImage: `url(${imageUrl})`, filter: "blur(16px) saturate(1.15) brightness(.42)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(70% 60% at 8% 4%, ${tone[0]}, transparent 72%), radial-gradient(70% 65% at 96% 100%, ${tone[1]}, transparent 72%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(95%_85%_at_50%_45%,transparent_35%,rgba(1,5,10,.88))]"
      />
      <div
        className={cn(
          "relative mx-auto flex h-full w-full max-w-6xl flex-col px-5 pt-24 pb-8 sm:px-10 sm:pt-28 sm:pb-12",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export { StoryFrame };
export { StoryKicker } from "./components/story-kicker";
export { StoryTitle } from "./components/story-title";
export { StoryText } from "./components/story-text";
export { Em } from "./components/em";
