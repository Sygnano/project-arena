import { fetchRefreshStream } from "@/lib/api";
import { isKnownPlatform } from "@/lib/riot";
import { parseRiotIdSlug } from "@/lib/riot-id";
import { visitorIp } from "@/lib/visitor-ip";

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

  let upstream: Response;
  try {
    upstream = await fetchRefreshStream(platform, parsed.gameName, parsed.tagLine, {
      visitorIp: visitorIp(request.headers),
      signal: request.signal,
    });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: upstream.status === 400 ? "invalid" : "unavailable" },
      { status: upstream.status === 400 ? 400 : 502 },
    );
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
