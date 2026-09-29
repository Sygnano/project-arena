"use client";

import { useEffect } from "react";

let started = false;

/**
 * Warms the browser cache with every champion, augment and item icon a
 * recap can show, from any page (the splash included), so the recap's
 * slides never wait on them. Starts only once the page itself has finished
 * loading, and uses `<link rel="prefetch">`, which the browser fetches at
 * its lowest priority, behind anything the page asks for. Once per visit.
 */
export function AssetPrefetch() {
  useEffect(() => {
    const prefetch = async () => {
      if (started) return;
      started = true;
      const res = await fetch("/api/catalog-icons");
      if (!res.ok) return;
      const urls: string[] = await res.json();
      const fragment = document.createDocumentFragment();
      for (const url of urls) {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.as = "image";
        link.href = url;
        fragment.append(link);
      }
      document.head.append(fragment);
    };
    const run = () => void prefetch().catch(() => {});

    if (document.readyState === "complete") run();
    else window.addEventListener("load", run, { once: true });
    return () => window.removeEventListener("load", run);
  }, []);

  return null;
}
