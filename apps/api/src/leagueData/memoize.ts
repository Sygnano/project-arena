/**
 * Runs `load` once and hands every caller the same promise, so concurrent
 * requests on a cold start share one download. A failure isn't kept: the
 * next call tries again instead of failing until the process restarts.
 *
 * Cached for the process's lifetime: static data changes once a patch, and
 * a deploy or restart picks up the new one.
 */
export function memoizeAsync<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null;
  return () => {
    if (!cached) {
      cached = load();
      cached.catch(() => {
        cached = null;
      });
    }
    return cached;
  };
}
