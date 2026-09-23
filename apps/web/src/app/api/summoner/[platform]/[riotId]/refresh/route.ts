import { refreshStreamUrl } from "@/lib/api";
import { isKnownPlatform } from "@/lib/riot";
import { parseRiotIdSlug } from "@/lib/riot-id";

/** The visitor's IP as the hosting proxy reports it, for the API's
 * per-visitor rate limit. The LAST `x-forwarded-for` entry, the one Railway's
 * edge appends: entries before it are whatever the client sent, so reading
 * the first one let anyone pick their own rate-limit key. Null in local dev,
 * where nothing sets it. */
function visitorIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || null;
}

/**
 * The summoner page's refresh stream, proxied as is so the API's address
 * stays server-only: server-sent events from resolving the Riot ID to the
 * new recap (see `RefreshEvent` in @arena/types). The browser leaving aborts
 * the upstream request; the fetch itself carries on in the API.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/summoner/[platform]/[riotId]/refresh">) {
  // Only this site's own pages may start a fetch from a browser: another
  // site could otherwise make its visitors' browsers spend Riot calls, each
  // under that visitor's rate limit. Browsers label every request with
  // Sec-Fetch-Site; clients without it (scripts) meet the rate limit anyway.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return Response.json({ error: "forbidden" }, { status: 403 });

  const { platform, riotId } = await params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed || !isKnownPlatform(platform)) return Response.json({ error: "invalid" }, { status: 400 });

  const ip = visitorIp(request);
  let upstream: Response;
  try {
    upstream = await fetch(refreshStreamUrl(platform, parsed.gameName, parsed.tagLine), {
      method: "POST",
      headers: ip ? { "x-arena-client-ip": ip } : {},
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: upstream.status === 400 ? "invalid" : "unavailable" }, { status: upstream.status === 400 ? 400 : 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
