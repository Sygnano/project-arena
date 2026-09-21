"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/logo";
import { RiotIdSearch } from "@/components/riot-id-search";

// Scrolled past this, scrolling down hides the bar.
const HIDE_AFTER_PX = 64;
// Pointer this close to the top edge brings a hidden bar back (desktop).
const REVEAL_ZONE_PX = 56;

/**
 * The summoner pages' persistent bar: the logo (home) and a compact Riot ID
 * search. It overlays the page instead of taking height from it, because
 * deck-layout slides fill exactly one viewport — so it slides away while
 * scrolling down through the recap and comes back on scroll up, near the
 * top edge, or while it holds focus. Listens in the capture phase to catch
 * the recap's own scroll container (`#summoner-scroll`) as well as the page.
 */
function TopBar() {
  const [hidden, setHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let lastTop = 0;
    const onScroll = (event: Event) => {
      const target = event.target;
      const top =
        target instanceof HTMLElement ? target.scrollTop : document.scrollingElement?.scrollTop ?? 0;
      const delta = top - lastTop;
      lastTop = top;
      if (barRef.current?.contains(document.activeElement)) return;
      if (top < HIDE_AFTER_PX || delta < -4) setHidden(false);
      else if (delta > 4) setHidden(true);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.clientY < REVEAL_ZONE_PX) setHidden(false);
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  const collapsed = hidden && !searchOpen;

  return (
    <header
      ref={barRef}
      onFocus={() => setHidden(false)}
      className={cn(
        "fixed inset-x-0 top-0 z-[60] transition-transform duration-300 ease-out motion-reduce:transition-none",
        collapsed && "-translate-y-full",
      )}
    >
      <div className="relative flex h-14 items-center gap-4 bg-[linear-gradient(180deg,rgba(1,5,10,.92),rgba(5,14,22,.72))] px-4 backdrop-blur-md sm:px-6">
        <Link
          href="/"
          aria-label="Arena Stats — search"
          className="flex-none opacity-90 transition-opacity hover:opacity-100"
        >
          <Logo size="sm" />
        </Link>
        <div className="ml-auto hidden w-full max-w-md md:block">
          <RiotIdSearch variant="compact" />
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen((open) => !open)}
          aria-expanded={searchOpen}
          aria-controls="top-bar-search"
          aria-label={searchOpen ? "Close search" : "Search a summoner"}
          className="ml-auto flex h-9 w-9 items-center justify-center border border-[rgba(200,170,110,.35)] text-lol-gold-100 md:hidden"
        >
          {searchOpen ? <X aria-hidden className="h-4 w-4" /> : <Search aria-hidden className="h-4 w-4" />}
        </button>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(200,170,110,.45)_20%,rgba(200,170,110,.45)_80%,transparent)]"
        />
      </div>
      {searchOpen ? (
        <div
          id="top-bar-search"
          className="border-b border-[rgba(200,170,110,.3)] bg-[rgba(5,14,22,.95)] px-4 pt-3 pb-4 backdrop-blur-md md:hidden"
        >
          <RiotIdSearch variant="compact" autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      ) : null}
    </header>
  );
}

export { TopBar };
