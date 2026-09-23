import "server-only";

/**
 * The visitor's IP as the hosting proxy reports it, for the API's
 * per-visitor rate limits. The LAST `x-forwarded-for` entry, the one
 * Railway's edge appends: entries before it are whatever the client sent,
 * so reading the first one let anyone pick their own rate-limit key. Null in
 * local dev, where nothing sets it (the API then counts this server's
 * address). A CDN in front of Railway would change which entry is right.
 */
export function visitorIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || null;
}
