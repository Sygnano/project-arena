"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "cn";

/**
 * Shares the current page's link: the system share sheet on touch devices
 * (where one exists), otherwise a copy to the clipboard with a short
 * "copied" confirmation. Drops the `#section` hash so a shared recap always
 * opens on its cover.
 */
function ShareButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const share = async () => {
    const url = window.location.href.split("#")[0];
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: document.title, url });
      } catch {
        // Dismissed the sheet: nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions, insecure origin): the URL bar remains.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "Link copied" : "Share this page"}
      className={cn(
        "flex h-9 items-center justify-center gap-2 border border-[rgba(200,170,110,.35)] px-2.5 text-[11px] tracking-[.24em] text-lol-gold-100 transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50",
        className,
      )}
    >
      {copied ? (
        <Check aria-hidden className="h-4 w-4 text-lol-blue-200" />
      ) : (
        <Share2 aria-hidden className="h-4 w-4" />
      )}
      <span aria-live="polite" className="hidden lg:inline">
        {copied ? "COPIED" : "SHARE"}
      </span>
    </button>
  );
}

export { ShareButton };
