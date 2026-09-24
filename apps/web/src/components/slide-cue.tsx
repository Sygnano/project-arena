"use client";

import { cn } from "cn";
import { scrollToSlide, useSlide } from "@/lib/slides";

/**
 * The "scroll to next section" cue at the bottom of a summoner-page section:
 * gold diamond, the next section's short label, and a chevron. Label and
 * target both come from the slide registry (`useSlide`), so a cue can't
 * point at a stale or misspelled section name. Renders nothing on the last
 * slide.
 */
function SlideCue({ className, prefix }: { className?: string; prefix?: string }) {
  const slide = useSlide();
  if (!slide?.next) return null;
  const { id, label } = slide.next;

  return (
    <button
      type="button"
      onClick={() => scrollToSlide(id)}
      aria-label={`Next section: ${label}`}
      className={cn(
        "kda-rise group absolute inset-x-0 bottom-5.5 mx-auto flex w-fit cursor-pointer flex-col items-center gap-2.25 px-4 transition-[filter] duration-150 hover:brightness-125",
        className,
      )}
    >
      <span
        aria-hidden
        className="-mb-px block h-2.75 w-2.75 rotate-45 border bg-[#040c14]"
        style={{ borderColor: "rgba(200,170,110,.7)" }}
      />
      <span className="pl-[.34em] text-[11.5px] tracking-[.34em] text-lol-gold-300 transition-colors duration-150 group-hover:text-lol-gold-50">
        {prefix ? `${prefix} · ` : null}
        {label}
      </span>
      <svg aria-hidden viewBox="0 0 18 8" className="block h-2 w-4.5">
        <path d="M1 1 L9 7 L17 1" fill="none" stroke="var(--color-lol-gold-300)" strokeWidth="1.4" opacity=".75" />
      </svg>
    </button>
  );
}

export { SlideCue };
