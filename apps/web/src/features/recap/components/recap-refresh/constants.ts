// Mirrors the API's REFRESH_COOLDOWN_MS: a refresh within this long of the
// last one just returns the same recap, so the button only shows after it.
const STALE_MS = 15 * 60_000;
const MINUTE_MS = 60_000;

const BUTTON_CLASS =
  "flex items-center gap-2 border border-[rgba(200,170,110,.45)] bg-[rgba(5,14,22,.6)] px-3 py-1.5 text-lol-gold-100 transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50";

export { BUTTON_CLASS, MINUTE_MS, STALE_MS };
