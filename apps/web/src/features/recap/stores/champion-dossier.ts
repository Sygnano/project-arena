import { useEffect } from "react";
import { scrollToSlide } from "@/features/recap/utils/scroll-to-slide";

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

export { openChampionDossier, useOpenDossierRequests };
