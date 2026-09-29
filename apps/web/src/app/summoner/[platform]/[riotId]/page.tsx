import type { Metadata } from "next";
import { RecapRoute } from "./_components/recap-route";
import { recapMetadata } from "./_lib/recap-metadata";

export async function generateMetadata(props: PageProps<"/summoner/[platform]/[riotId]">): Promise<Metadata> {
  return recapMetadata(await props.params, "story");
}

/** The summoner's page: the story recap's cover, or the "fetch matches"
 * screen until their matches have been fetched once. */
export default async function SummonerPage(props: PageProps<"/summoner/[platform]/[riotId]">) {
  return <RecapRoute params={await props.params} view="story" />;
}
