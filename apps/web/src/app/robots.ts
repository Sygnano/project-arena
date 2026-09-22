import type { MetadataRoute } from "next";

/**
 * Crawling stays allowed so link-preview bots (Twitterbot honors this file)
 * can read a shared recap's card; the pages themselves carry `noindex` (root
 * layout), which keeps them out of search results. `/api/` is the queue
 * screen's polling proxy, nothing to crawl.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
}
