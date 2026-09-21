"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Reveal } from "@/components/reveal";
import { SectionEdgeFade } from "@/components/section-background";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { useSlide } from "@/lib/slides";

type Props = {
  imageUrl: string;
  backgroundPosition?: string;
  /** Accessible name source for the section (id of its heading). */
  labelledBy?: string;
  children: ReactNode;
  /** Rendered after the centered content, e.g. a `SlideCue`. */
  footer?: ReactNode;
  className?: string;
  /** Load the background photo immediately instead of when the section nears
   * the viewport — for the first screen. */
  eager?: boolean;
};

/**
 * The bespoke single-column "hero" screen shared by the summoner page's
 * opening (Welcome) and closing (Farewell) sections: a sharper `blur(2px)`
 * background stack than `CategorySection`'s, corner brackets, and centered
 * content. Previously copy-pasted across Welcome, Farewell and ThankYou.
 *
 * Fills the viewport in the `deck` layout and grows with its content in
 * `flow`, so nothing is clipped on short or narrow screens.
 */
function HeroSection({
  imageUrl,
  backgroundPosition = "center 42%",
  labelledBy,
  children,
  footer,
  className,
  eager = false,
}: Props) {
  const slide = useSlide();
  const [photoRef, isNear] = useNearViewport<HTMLDivElement>(!eager);
  return (
    <section
      id={slide?.id}
      aria-labelledby={labelledBy}
      className={cn(
        "relative w-full min-h-dvh overflow-hidden bg-lol-navy-950 deck:h-dvh deck:snap-start deck:snap-always",
        className,
      )}
    >
      <div
        ref={photoRef}
        aria-hidden
        className="absolute -inset-5"
        style={{
          backgroundImage: isNear ? `url(${imageUrl})` : undefined,
          backgroundPosition,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          filter: "blur(2px) saturate(.75) brightness(.54) contrast(1.06)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(78% 70% at 50% 48%, rgba(3,10,18,.2) 0%, rgba(2,8,14,.8) 58%, #01050a 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(9,20,40,.5), transparent 34%, transparent 62%, rgba(1,5,10,.9))",
        }}
      />
      <SectionEdgeFade />

      <div aria-hidden className="pointer-events-none absolute inset-4 sm:inset-10">
        <div className="absolute top-0 left-0 h-5 w-5 border-t border-l border-[rgba(200,170,110,.5)]" />
        <div className="absolute top-0 right-0 h-5 w-5 border-t border-r border-[rgba(200,170,110,.5)]" />
        <div className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-[rgba(200,170,110,.5)]" />
        <div className="absolute right-0 bottom-0 h-5 w-5 border-r border-b border-[rgba(200,170,110,.5)]" />
      </div>

      <Reveal className="relative flex min-h-dvh flex-col items-center justify-center px-6 pt-16 pb-32 sm:px-14 deck:h-full deck:min-h-0">
        {children}
      </Reveal>
      {footer}
    </section>
  );
}

export { HeroSection };
