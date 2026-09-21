import { getSummonerStatus } from "@/lib/api";
import { parseRiotIdSlug } from "@/lib/riot-id";

/** Browser-side polling for the summoner page's queue screen, proxied so
 * the API's address stays server-only. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/summoner/[platform]/[riotId]/status">,
) {
  const { platform, riotId } = await params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    const status = await getSummonerStatus(platform, parsed.gameName, parsed.tagLine);
    if (!status) return Response.json({ error: "not_tracked" }, { status: 404 });
    return Response.json(status);
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
