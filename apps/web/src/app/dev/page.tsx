import type { Metadata } from "next";
import { getDevSummoners } from "@/features/dev/api/get-dev-summoners";
import { DevSummoners } from "@/features/dev/components/dev-summoners";

export const metadata: Metadata = {
  title: "Dev · Arena Journey",
};

// A debug view of the database: always read it fresh.
export const dynamic = "force-dynamic";

export default async function DevPage() {
  return <DevSummoners {...await getDevSummoners()} />;
}
