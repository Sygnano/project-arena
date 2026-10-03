import "server-only";
import { apiFetch } from "@/lib/api-client";

/** Site-wide totals for the splash page, from the API's `GET /overview`. */
type Overview = {
  /** Every Arena match stored. */
  matchCount: number;
  /** Summoners with a recap: refreshed at least once, with a stored match. */
  recapCount: number;
};

async function getOverview(): Promise<Overview> {
  const res = await apiFetch("/overview");
  if (!res.ok) throw new Error(`Failed to load the overview (${res.status})`);
  return res.json();
}

export type { Overview };
export { getOverview };
