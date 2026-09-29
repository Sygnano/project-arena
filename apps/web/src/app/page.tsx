import { getOverview } from "@/features/overview/api/get-overview";
import { Splash } from "./_components/splash";

export default async function Home() {
  // The totals are a garnish: without the API the search still renders.
  const overview = await getOverview().catch(() => null);
  return <Splash overview={overview} />;
}
