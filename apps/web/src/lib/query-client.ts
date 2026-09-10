import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // This app's only query today is fetched fresh server-side on every
        // page load (see page.tsx's queryClient.fetchQuery), then hydrated
        // into the browser's cache. Infinity keeps the client from ever
        // silently re-running the queryFn on its own (window focus, mount,
        // reconnect, ...) — apps/web/src/lib/api.ts's fetch reads
        // `process.env.API_URL`, which Next.js does NOT inline into the
        // client bundle (no NEXT_PUBLIC_ prefix), so a browser-triggered
        // refetch would silently fall back to the http://localhost:3001
        // dev default in any real deployment. Revisit once there's an
        // actual browser-reachable API URL and a reason to refetch live
        // (e.g. a manual "refresh" button).
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
