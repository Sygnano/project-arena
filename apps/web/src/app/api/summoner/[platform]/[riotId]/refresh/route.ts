import { refreshStreamUrl } from "@/lib/api";
import { parseRiotIdSlug } from "@/lib/riot-id";

/** The visitor's IP as the hosting proxy reports it (the first
 * `x-forwarded-for` entry is the original client), for the API's per-visitor
 * rate limit. Null in local dev, where nothing sets these. */
function visitorIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

/**
 * The summoner page's refresh stream, proxied as is so the API's address
 * stays server-only: server-sent events from resolving the Riot ID to the
 * new recap (see `RefreshEvent` in @arena/types). The browser leaving aborts
 * the upstream request; the fetch itself carries on in the API.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/summoner/[platform]/[riotId]/refresh">) {
  const { platform, riotId } = await params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed) return Response.json({ error: "invalid" }, { status: 400 });

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
