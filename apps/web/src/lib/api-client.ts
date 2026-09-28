import "server-only";

// Server-only (no NEXT_PUBLIC_ prefix, and `server-only` above keeps this
// module out of client bundles): the browser reaches the API through this
// app's own routes (`app/api/...`) and pages, never directly. Each feature's
// requests live in its own `api/` folder and call `apiFetch`; client-safe
// helpers live in `features/recap/api/summoner-query.ts`.
const API_URL = process.env.API_URL ?? "http://localhost:3001";
// Shared with the API, which refuses every request without it once set
// (apps/api/src/index.ts). Unset in local dev, like the API's.
const API_PROXY_SECRET = process.env.API_PROXY_SECRET;

// A read that takes longer fails (a TimeoutError) instead of hanging the
// page's render forever when the API is stuck. The slowest read, an
// uncached recap, takes well under a second; this leaves room for an API
// busy with other work. Covers the body too: `res.json()` shares the signal.
const READ_TIMEOUT_MS = 10_000;

/**
 * Every call to the API. `visitorIp` (see `lib/visitor-ip.ts`) is what the
 * API rate-limits by; without it the API counts this server's address. A
 * call without its own `signal` times out after READ_TIMEOUT_MS; the refresh
 * stream passes its own, since it stays open for as long as the fetch runs.
 */
function apiFetch(path: string, { visitorIp, ...init }: RequestInit & { visitorIp?: string | null } = {}) {
  const headers = new Headers(init.headers);
  if (API_PROXY_SECRET) headers.set("x-arena-proxy-secret", API_PROXY_SECRET);
  if (visitorIp) headers.set("x-arena-client-ip", visitorIp);
  return fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    signal: init.signal ?? AbortSignal.timeout(READ_TIMEOUT_MS),
    headers,
  });
}

export { apiFetch };
