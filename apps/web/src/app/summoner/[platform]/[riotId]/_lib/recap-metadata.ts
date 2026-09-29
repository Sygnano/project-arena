import type { Metadata } from "next";
import { isKnownPlatform } from "@/utils/riot";
import { parseRiotIdSlug, summonerPath } from "@/utils/riot-id";
import { describeRecap } from "@/features/recap/utils/describe-recap";
import { loadSummonerPage } from "./load-summoner-page";

/** The tab title and link preview of a summoner's recap, either view. */
export async function recapMetadata(
  { platform, riotId }: { platform: string; riotId: string },
  view: "story" | "advanced",
): Promise<Metadata> {
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed || !isKnownPlatform(platform)) return { title: "Arena Journey" };
  // A preview without the summoner beats no page: the page reports the error.
  const summoner =
    (await loadSummonerPage(platform, parsed.gameName, parsed.tagLine).catch(() => null))?.summoner ?? null;
  const name = summoner ? `${summoner.gameName}#${summoner.tagLine}` : `${parsed.gameName}#${parsed.tagLine}`;
  const description = describeRecap(summoner, platform);
  // Link previews name only stored summoners: otherwise any URL would put
  // its own text in a card under this site's name (the tab keeps the name).
  const kind = view === "story" ? "Arena season recap" : "Arena full stats";
  const previewTitle = summoner ? `${name} · ${kind}` : kind;
  // The card lives beside the story page (its `opengraph-image`); the full
  // stats point at the same one. Set only there: even `images: undefined`
  // would override the story page's own card.
  const images =
    view === "advanced"
      ? { images: [`${summonerPath(platform, parsed.gameName, parsed.tagLine)}/opengraph-image`] }
      : {};
  return {
    title: view === "story" ? `${name} · Arena Journey` : `${name} · Full stats · Arena Journey`,
    description,
    openGraph: { title: previewTitle, description, siteName: "Arena Journey", type: "website", ...images },
    twitter: { card: "summary_large_image", title: previewTitle, description, ...images },
  };
}
