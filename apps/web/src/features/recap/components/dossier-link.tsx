"use client";

import { openChampionDossier } from "@/features/recap/stores/champion-dossier";

/** Small "FULL STATS" link that jumps to the champion's dossier in Collection. */
type Props = { championId: number; className?: string };

function DossierLink({ championId, className }: Props) {
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

export { DossierLink };
