import type { Metadata } from "next";
import { RecapRoute } from "@/app/summoner/[platform]/[riotId]/_components/recap-route";
import { recapMetadata } from "@/app/summoner/[platform]/[riotId]/_lib/recap-metadata";

export async function generateMetadata(props: PageProps<"/summoner/[platform]/[riotId]/advanced">): Promise<Metadata> {
  return recapMetadata(await props.params, "advanced");
}

/** The summoner's full stats: every expert slide. A summoner without a
 * recap yet is sent to their page, which offers the first fetch. */
export default async function SummonerAdvancedPage(props: PageProps<"/summoner/[platform]/[riotId]/advanced">) {
  return <RecapRoute params={await props.params} view="advanced" />;
}
