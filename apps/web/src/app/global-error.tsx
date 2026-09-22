"use client";

import { beaufort, spiegel } from "@/fonts";
import { NewSearchLink, StatusScreen, actionClass } from "@/components/status-screen";
import "./globals.css";

/**
 * Last resort when the root layout itself fails: it replaces the layout, so
 * it brings its own `<html>`, fonts and styles.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en" className={`${beaufort.variable} ${spiegel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <StatusScreen
          eyebrow="SOMETHING WENT WRONG"
          title="ARENA JOURNEY IS DOWN"
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
            The site hit an unexpected error. Try again in a moment.
          </p>
        </StatusScreen>
      </body>
    </html>
  );
}
