import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // This app's only query (the recap) is fetched server-side on every
        // page load (page.tsx) or put in the cache by the refresh stream, then
        // read from the cache in the browser, which never fetches it: the
        // fetcher is server-only (lib/api.ts) and the query is disabled in
        // stats-view.tsx. Infinity also keeps hydrated data from counting as
        // stale.
        staleTime: Infinity,
      },
    },
  });
}

// A fresh QueryClient per server request (React's request isolation means a
// module-level singleton would leak state across requests/users), but one
// long-lived instance in the browser shared across client-side navigations
// — the standard split from TanStack Query's Next.js App Router guide.
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
