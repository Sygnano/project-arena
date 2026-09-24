"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";
import { scrollToSlide } from "@/lib/slides";

type RailSlide = {
  id: string;
  /** Short uppercase label, also used on the previous slide's next cue. */
  label: string;
  /** Chapter heading this slide is grouped under in the rail. */
  chapter: string;
};

/**
 * Fixed vertical navigation for the summoner page: one diamond per section,
 * grouped by chapter, the current section lit. Pointing at the diamond column
 * (not the invisible label area beside it) or keyboard-focusing the rail
 * reveals every label over a dimmed backdrop; clicking jumps straight there. The current
 * section is mirrored into the URL hash (`#augments`) with `replaceState`, so
 * a copied link opens on the same section, and an incoming hash is honored
 * on load.
 *
 * A thin line joins consecutive diamonds and fills with gold as the page
 * scrolls from one section to the next; every diamond already scrolled past
 * stays filled, so the rail doubles as a progress bar.
 *
 * Hidden below `md`: on phones the page is a normal vertical scroll (the
 * `flow` layout) and a rail would cover content.
 */
function ChapterRail({ slides }: { slides: readonly RailSlide[] }) {
  const [activeId, setActiveId] = useState(slides[0]?.id ?? "");
  // Index of the furthest section whose top has been scrolled to.
  const [passedIndex, setPassedIndex] = useState(0);
  // Labels are revealed only once the pointer reaches the diamond column; the
  // rest of the rail ignores the pointer until then.
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const markerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // Vertical centers of each diamond inside the list, for the connector lines.
  const [centers, setCenters] = useState<number[]>([]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const listTop = list.getBoundingClientRect().top;
      setCenters(
        markerRefs.current.slice(0, slides.length).map((marker) => {
          if (!marker) return 0;
          const rect = marker.getBoundingClientRect();
          return rect.top - listTop + rect.height / 2;
        }),
      );
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(list);
    return () => resize.disconnect();
  }, [slides]);

  useEffect(() => {
    const root = document.getElementById("summoner-scroll");
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rootTop = root.getBoundingClientRect().top;
      const tops = slides.map((slide) => {
        const el = document.getElementById(slide.id);
        return el ? el.getBoundingClientRect().top - rootTop + root.scrollTop : Infinity;
      });
      const atBottom = root.scrollTop >= root.scrollHeight - root.clientHeight - 1;
      // Fractional section position: 2.4 = 40% of the way from section 3 to 4.
      let progress = slides.length - 1;
      if (!atBottom) {
        for (let i = 0; i < tops.length - 1; i++) {
          if (root.scrollTop < tops[i + 1]) {
            const span = tops[i + 1] - tops[i];
            progress = i + (span > 0 ? Math.max(0, root.scrollTop - tops[i]) / span : 0);
            break;
          }
        }
      }
      fillRefs.current.forEach((fill, i) => {
        if (fill) fill.style.transform = `scaleY(${Math.min(1, Math.max(0, progress - i))})`;
      });
      setPassedIndex(Math.floor(progress + 0.001));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [slides, centers]);

  useEffect(() => {
    const initial = decodeURIComponent(window.location.hash.slice(1));
    if (initial && document.getElementById(initial)) {
      // The observer below reports the section as active once it's in view.
      document.getElementById(initial)?.scrollIntoView({ block: "start" });
    }

    const root = document.getElementById("summoner-scroll");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.id;
          setActiveId(id);
          if (window.location.hash.slice(1) !== id) {
            window.history.replaceState(null, "", `#${id}`);
          }
        }
      },
      // A section counts as current once it covers the viewport's middle.
      { root, rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    for (const slide of slides) {
      const el = document.getElementById(slide.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [slides]);

  const activeChapter = slides.find((slide) => slide.id === activeId)?.chapter;

  return (
    <nav
      aria-label="Summoner page sections"
      data-open={open || undefined}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      className={cn(
        "group/rail pointer-events-none fixed top-1/2 right-2 z-50 hidden max-h-[92dvh] -translate-y-1/2 overflow-y-auto py-3 pr-1 pl-8 md:block",
        // Backdrop behind the labels so they stay readable over section art.
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-l-sm before:bg-[linear-gradient(to_left,rgba(1,10,19,.94),rgba(1,10,19,.82)_65%,rgba(1,10,19,0))] before:opacity-0 before:backdrop-blur-sm before:transition-opacity before:duration-200",
        "data-open:pointer-events-auto data-open:before:opacity-100 focus-within:before:opacity-100",
      )}
    >
      <ol ref={listRef} className="relative flex flex-col items-end gap-0.5">
        {/* Hover target: a narrow strip over the diamonds opens the rail. */}
        <li aria-hidden className="pointer-events-auto absolute inset-y-0 -right-1 w-6" />
        {centers.slice(0, -1).map((top, i) => (
          <li
            key={`line-${slides[i]?.id}`}
            aria-hidden
            className="pointer-events-none absolute right-[4.5px] w-px bg-[rgba(200,170,110,.18)]"
            style={{ top, height: centers[i + 1] - top }}
          >
            <span
              ref={(el) => {
                fillRefs.current[i] = el;
              }}
              className="block h-full w-full origin-top bg-lol-gold-300 shadow-[0_0_6px_rgba(200,170,110,.6)]"
              style={{ transform: "scaleY(0)" }}
            />
          </li>
        ))}
        {slides.map((slide, index) => {
          const isActive = slide.id === activeId;
          const isPassed = index <= passedIndex;
          const startsChapter = slide.chapter !== slides[index - 1]?.chapter;
          return (
            <li key={slide.id} className={cn("relative", startsChapter && index > 0 && "mt-2.5")}>
              <a
                href={`#${slide.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSlide(slide.id);
                  window.history.replaceState(null, "", `#${slide.id}`);
                }}
                className="group/item pointer-events-none flex items-center gap-2.5 py-0.75 pl-3 group-data-open/rail:pointer-events-auto group-focus-within/rail:pointer-events-auto"
              >
                <span
                  className={cn(
                    "pointer-events-none text-[11px] tracking-[.22em] whitespace-nowrap transition-opacity duration-150",
                    "opacity-0 group-focus-within/rail:opacity-100 group-data-open/rail:opacity-100",
                    isActive ? "text-lol-gold-50" : "text-lol-text-muted group-hover/item:text-lol-gold-100",
                  )}
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,.9)" }}
                >
                  {startsChapter ? (
                    <span
                      className={cn(
                        "mr-2 text-[11px]",
                        slide.chapter === activeChapter ? "text-lol-gold-300" : "text-lol-text-muted",
                      )}
                    >
                      {slide.chapter} ·
                    </span>
                  ) : null}
                  {slide.label}
                </span>
                <span
                  aria-hidden
                  ref={(el) => {
                    markerRefs.current[index] = el;
                  }}
                  className="flex h-2.5 w-2.5 items-center justify-center"
                >
                  <span
                    className={cn(
                      "block rotate-45 border transition-all duration-200",
                      isActive
                        ? "h-2.5 w-2.5 border-lol-gold-50 bg-lol-gold-300 shadow-[0_0_10px_rgba(200,170,110,.7)]"
                        : isPassed
                          ? "h-1.75 w-1.75 border-lol-gold-100 bg-lol-gold-300"
                          : slide.chapter === activeChapter
                            ? "h-1.75 w-1.75 border-[rgba(200,170,110,.75)] bg-[#040c14]"
                            : "h-1.5 w-1.5 border-[rgba(200,170,110,.4)] bg-[#040c14]",
                    )}
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { ChapterRail };
export type { RailSlide };
