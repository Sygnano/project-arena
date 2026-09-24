"use client";

import { useEffect } from "react";
import { scrollToSlide } from "@/lib/slides";

const OPEN_DOSSIER_EVENT = "arena:open-champion-dossier";
const COLLECTION_SLIDE_ID = "collection";

/** Scrolls to the Collection section and opens this champion's dossier —
 * the cross-link from any section that ranks champions. */
function openChampionDossier(championId: number) {
  window.dispatchEvent(new CustomEvent<number>(OPEN_DOSSIER_EVENT, { detail: championId }));
  scrollToSlide(COLLECTION_SLIDE_ID);
}

/** Lets the Collection section answer `openChampionDossier` requests. */
function useOpenDossierRequests(onOpen: (championId: number) => void) {
  useEffect(() => {
    const listener = (event: Event) => onOpen((event as CustomEvent<number>).detail);
    window.addEventListener(OPEN_DOSSIER_EVENT, listener);
    return () => window.removeEventListener(OPEN_DOSSIER_EVENT, listener);
  }, [onOpen]);
}

/** Small "FULL STATS" link that jumps to the champion's dossier in Collection. */
function DossierLink({ championId, className }: { championId: number; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openChampionDossier(championId)}
      className={`group inline-flex cursor-pointer items-center gap-1.5 text-[11px] tracking-[.24em] text-lol-blue-300 transition-colors duration-150 hover:text-lol-blue-100 ${className ?? ""}`}
    >
      FULL STATS
      <svg
        viewBox="0 0 8 12"
        aria-hidden
        className="h-2.5 w-1.5 transition-transform duration-150 group-hover:translate-x-0.5"
      >
        <path d="M1 1 L6 6 L1 11" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </button>
  );
}

export { openChampionDossier, useOpenDossierRequests, DossierLink };
