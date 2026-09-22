import { useMemo, useSyncExternalStore } from "react";

/** One recap this browser opened, enough to draw its splash-page chip. */
export type RecentRecap = {
  region: string;
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
};

// Each browser keeps its own list: it's "the recaps I opened", not a
// site-wide feed (a shared one let anyone put any Riot ID on the homepage).
const STORAGE_KEY = "arena-journey:recent-recaps";
const MAX_RECENT = 12;
// `storage` events only reach other tabs; this one tells the current tab.
const CHANGE_EVENT = "arena-journey:recent-recaps-change";

const keyOf = (recap: RecentRecap) =>
  `${recap.region}/${recap.gameName}#${recap.tagLine}`.toLowerCase();

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // Storage blocked (private mode, disabled site data).
  }
}

function parse(raw: string | null): RecentRecap[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as RecentRecap[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** Puts a recap at the front of this browser's list (once per Riot ID). */
export function rememberRecap(recap: RecentRecap) {
  const next = [recap, ...parse(readRaw()).filter((r) => keyOf(r) !== keyOf(recap))].slice(
    0,
    MAX_RECENT,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Not remembered this time; nothing depends on it.
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** This browser's recently opened recaps, newest first. Empty on the server
 * render (it can't see the browser's storage); filled right after hydration. */
export function useRecentRecaps(): RecentRecap[] {
  // The raw string is the snapshot: stable between changes, so React doesn't
  // re-render on every read.
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parse(raw), [raw]);
}
