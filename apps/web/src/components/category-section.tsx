"use client";

import { useRef } from "react";
import { cn } from "cn";
import { SectionBackground } from "@/components/section-background";

interface CategorySectionProps {
  title: string;
  quote?: string;
  children?: React.ReactNode;
  /** Full-bleed blurred background photo behind the section (see
   * `SectionBackground`'s "background stack"). Omit for a plain dark
   * section — the section's own background only switches to
   * `bg-lol-navy-950` when a photo is supplied, so sections without one
   * keep showing the page's default background exactly as before. */
  imageUrl?: string;
  backgroundPosition?: string;
  /** Content for the fixed-width (344px) left "identity" column, rendered
   * below the title/quote header — e.g. KDA's dial + K/D/A totals list.
   * Passing this (even `null`) switches the section into the two-column
   * "identity column + panel" layout the Hextech design uses, with
   * `children` filling the panel column; omit it entirely for a simple
   * single-column section where `children` fills the whole width. */
  sidebar?: React.ReactNode;
  /** Label for the bottom "scroll to next section" cue. Omit to skip the
   * cue (e.g. the last section on the page). */
  nextSectionLabel?: string;
}

/**
 * One full-viewport "screen" in the summoner page's scroll-snap sequence.
 * `snap-always` (scroll-snap-stop: always) is what makes a single scroll
 * gesture land on the next section instead of skipping past several on a
 * fast flick/trackpad swipe.
 *
 * Owns the chrome shared by every section: an optional full-bleed
 * background photo, the "title + gold rule + italic quote" header, and an
 * optional bottom handoff cue that scrolls to whatever section follows.
 * This chrome (plus the two-column identity/panel layout below) was first
 * built bespoke for KDA (see `design_handoff_arena_kda/`) and is lifted
 * here so later sections (Damage, Champions, Items, Match history) get the
 * same treatment for free instead of re-implementing it per module.
 */
export function CategorySection({
  title,
  children,
  quote = "Allan add quote here",
  imageUrl,
  backgroundPosition,
  sidebar,
  nextSectionLabel,
}: CategorySectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  function scrollToNextSection() {
    sectionRef.current?.nextElementSibling?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const header = (
    <div>
      <div className="font-display text-[52px] leading-none tracking-[.08em] text-lol-gold-50">
        {title}
      </div>
      <div className="mt-3 h-px w-14 bg-[rgba(200,170,110,.6)]" />
      <div className="mt-3.5 min-h-[3.5em] text-sm text-lol-text-muted italic">
        &ldquo;{quote}&rdquo;
      </div>
    </div>
  );

  const cue = nextSectionLabel ? (
    <div
      onClick={scrollToNextSection}
      className="kda-rise absolute inset-x-0 bottom-5.5 flex cursor-pointer flex-col items-center gap-2.25 transition-[filter] duration-150 hover:brightness-125"
    >
      <div
        className="-mb-px h-2.75 w-2.75 rotate-45 border bg-[#040c14]"
        style={{ borderColor: "rgba(200,170,110,.7)" }}
      />
      <div className="pl-[.34em] text-[11.5px] tracking-[.34em] text-lol-gold-300 transition-colors duration-150 hover:text-lol-gold-50">
        {nextSectionLabel}
      </div>
      <svg viewBox="0 0 18 8" className="block h-2 w-4.5">
        <path
          d="M1 1 L9 7 L17 1"
          fill="none"
          stroke="var(--color-lol-gold-300)"
          strokeWidth="1.4"
          opacity=".75"
        />
      </svg>
    </div>
  ) : null;

  return (
    <section
      ref={sectionRef}
      className={cn(
        "relative h-screen w-full snap-start snap-always overflow-hidden",
        imageUrl && "bg-lol-navy-950",
      )}
    >
      {imageUrl ? (
        <SectionBackground
          imageUrl={imageUrl}
          backgroundPosition={backgroundPosition}
        />
      ) : null}

      {/* Caps the frame itself (not the background, which stays full-bleed
        behind it) at a size that reads well on a typical modern desktop
        monitor — beyond ultrawide/4K viewports this stops growing and
        centers instead of stretching the layout out to an oversized,
        disproportionate result. Shared by both layout modes below so every
        section clamps and centers the same way. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-full max-h-[1080px] w-full max-w-[1920px]">
          {sidebar !== undefined ? (
            <div
              className="absolute inset-0 grid gap-12 px-21 pt-18 pb-26"
              style={{ gridTemplateColumns: "344px minmax(0,1fr)" }}
            >
              <div className="flex flex-col">
                {header}
                {sidebar}
              </div>
              {children}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col px-21 pt-18 pb-26">
              <div className="mb-12">{header}</div>
              {/* `grid` rather than `flex` so its child stretches to fill
                the remaining height via CSS Grid's default
                `align-items: stretch` — a plain flex child stays
                content-sized instead, leaving anything relying on
                `h-full` (e.g. a `HextechPanel` body) collapsed to 0. */}
              <div className="grid min-h-0 flex-1">{children}</div>
            </div>
          )}

          {nextSectionLabel ? (
            <div
              className="absolute right-21 bottom-19 left-21 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(200,170,110,.24) 26%, rgba(200,170,110,.24) 42%, transparent 47%, transparent 53%, rgba(200,170,110,.24) 58%, rgba(200,170,110,.24) 74%, transparent)",
              }}
            />
          ) : null}
          {cue}
        </div>
      </div>
    </section>
  );
}
