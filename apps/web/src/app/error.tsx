"use client";

import { NewSearchLink, StatusScreen, actionClass } from "@/components/status-screen";

/**
 * Anything that throws outside the summoner page, which has its own
 * (`app/summoner/[platform]/[riotId]/error.tsx`). The root layout's own
 * failures fall through to `global-error.tsx`.
 */
export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StatusScreen
      eyebrow="SOMETHING WENT WRONG"
      title="THIS PAGE BROKE"
      actions={
        <>
          <button type="button" onClick={reset} className={actionClass}>
            TRY AGAIN
          </button>
          <NewSearchLink className="border-[rgba(200,170,110,.3)] text-lol-text-secondary" />
        </>
      }
    >
      <p className="text-lol-text-secondary">
        An unexpected error stopped this page from loading. Try again, or start a new search.
      </p>
    </StatusScreen>
  );
}
