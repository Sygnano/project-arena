import { cache } from "react";
import { getSummonerPage } from "@/features/recap/api/get-summoner-page";

/** One read per request, shared by a page's `generateMetadata` and its render. */
export const loadSummonerPage = cache(getSummonerPage);
