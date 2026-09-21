"use client";

import { cn } from "cn";
import { Reveal } from "@/components/reveal";
import { SectionBackground } from "@/components/section-background";
import { SlideCue } from "@/components/slide-cue";
import { useSectionInView } from "@/hooks/use-section-in-view";
import { useSlide } from "@/lib/slides";

interface CategorySectionProps {
  title: string;
  /** Italic epigraph under the title. Optional — omitted, the header simply
   * has no quote line (there is deliberately no placeholder default). */
  quote?: string;
  /** One line of plain-language context under the title, for sections whose
   * mechanic or metric isn't self-explanatory (e.g. what "Guests of Honor"
   * are). Shown above the quote. */
  description?: string;
  children?: React.ReactNode;
  /** Full-bleed blurred background photo behind the section (see
   * `SectionBackground`'s "background stack"). */
  imageUrl?: string;
  backgroundPosition?: string;
  /** Content for the fixed-width (344px) left "identity" column, rendered
   * below the title/quote header. Passing this (even `null`) switches the
   * section into the two-column "identity column + panel" layout, with
   * `children` filling the panel column; omit it for a single-column section
   * where `children` fills the whole width. */
  sidebar?: React.ReactNode;
  /** Content rendered beside the title/quote header, on a no-`sidebar`
   * section only (e.g. a hall-of-fame stat strip). Ignored when `sidebar` is
   * set. */
  headerRight?: React.ReactNode;
}

/**
 * One section of the summoner page's scroll sequence.
 *
 * Two layout modes (see the `deck`/`flow` custom variants in globals.css):
 * - **deck** (≥1280px wide and ≥860px tall): the designed full-viewport,
 *   scroll-snapped slide — a fixed composition capped at 1920×1080.
 * - **flow** (anything smaller): the section grows to fit its content and the
 *   page scrolls normally. The identity column stacks above the panel below
 *   `xl`, and the panel gets an explicit height so charts and lists that fill
 *   their panel still have one to fill. Previously every viewport got the deck
 *   layout inside `h-screen overflow-hidden`, which silently clipped a sidebar
 *   slide's bottom ~200px on a 1366×768 laptop and broke entirely on phones.
 *
 * The section's DOM id and bottom cue come from the slide registry
 * (`useSlide`), not from props.
 */
/** The panel column comes up a beat after the title column, so a section
 * reads left-to-right (title, then its content) instead of arriving flat. */
const PANEL_REVEAL_DELAY_MS = 120;

export function CategorySection({
  title,
  children,
  quote,
  description,
  imageUrl,
  backgroundPosition,
  sidebar,
  headerRight,
}: CategorySectionProps) {
  const slide = useSlide();
  const headingId = slide ? `${slide.id}-title` : undefined;
  // One trigger for the whole slide: the section always spans the scroll
  // container's middle band while it's the current slide, whereas a
  // full-width slide's own title row sits above that band and, observed on
  // its own, never faded in.
  const [sectionRef, inView] = useSectionInView<HTMLElement>();

  const header = (
    <div>
      <h2
        id={headingId}
        className="font-display text-[clamp(34px,7vw,52px)] leading-none tracking-[.08em] text-lol-gold-50"
      >
        {title}
      </h2>
      <div aria-hidden className="mt-3 h-px w-14 bg-[rgba(200,170,110,.6)]" />
      {description ? (
        <p className="mt-3.5 max-w-xl text-[14px] leading-relaxed text-lol-text-secondary">
          {description}
        </p>
      ) : null}
      {quote ? (
        <p className="mt-3 text-base text-lol-text-muted italic deck:min-h-[3em]">
          &ldquo;{quote}&rdquo;
        </p>
      ) : null}
    </div>
  );

  // The panel column needs a definite height in flow mode: charts and row
  // lists inside a HextechPanel fill `h-full`/`flex-1` rather than sizing to
  // their content.
  const panelSlot = (
    <Reveal
      inView={inView}
      delayMs={PANEL_REVEAL_DELAY_MS}
      className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] flow:h-[max(640px,min(88dvh,820px))]"
    >
      {children}
    </Reveal>
  );

  return (
    <section
      ref={sectionRef}
      id={slide?.id}
      aria-labelledby={headingId}
      className={cn(
        "relative w-full min-h-dvh overflow-x-clip deck:h-dvh deck:snap-start deck:snap-always deck:overflow-hidden",
        imageUrl && "bg-lol-navy-950",
      )}
    >
      {imageUrl ? (
        <SectionBackground imageUrl={imageUrl} backgroundPosition={backgroundPosition} />
      ) : null}

      {/* Caps the frame (not the full-bleed background) at 1920×1080 and
        centers it beyond that, in both layout modes. */}
      <div className="relative flex justify-center deck:absolute deck:inset-0 deck:items-center">
        <div className="relative w-full max-w-[1920px] deck:h-full deck:max-h-[1080px]">
          {sidebar !== undefined ? (
            <div className="flex flex-col gap-10 px-5 pt-16 pb-28 sm:px-10 xl:grid xl:grid-cols-[344px_minmax(0,1fr)] xl:gap-12 xl:px-21 deck:absolute deck:inset-0 deck:grid-rows-[minmax(0,1fr)] deck:pt-18 deck:pb-26">
              <Reveal inView={inView} className="flex flex-col">
                {header}
                {sidebar}
              </Reveal>
              {panelSlot}
            </div>
          ) : (
            <div className="flex flex-col px-5 pt-16 pb-28 sm:px-10 xl:px-21 deck:absolute deck:inset-0 deck:pt-18 deck:pb-26">
              <Reveal inView={inView} className="flex flex-wrap items-end gap-x-12 gap-y-6">
                {header}
                {headerRight ? (
                  <>
                    <div className="hidden flex-1 lg:block" />
                    <div className="max-w-full overflow-x-auto">{headerRight}</div>
                  </>
                ) : null}
              </Reveal>
              <Reveal
                inView={inView}
                delayMs={PANEL_REVEAL_DELAY_MS}
                className="mt-2 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] flow:h-[max(640px,min(88dvh,820px))] flow:flex-none"
              >
                {children}
              </Reveal>
            </div>
          )}

          {slide?.next ? (
            <div
              aria-hidden
              className="absolute right-5 bottom-19 left-5 h-px sm:right-10 sm:left-10 xl:right-21 xl:left-21"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(200,170,110,.24) 26%, rgba(200,170,110,.24) 42%, transparent 47%, transparent 53%, rgba(200,170,110,.24) 58%, rgba(200,170,110,.24) 74%, transparent)",
              }}
            />
          ) : null}
          <SlideCue />
        </div>
      </div>
    </section>
  );
}
