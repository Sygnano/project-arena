import type { Metadata } from "next";
import Link from "next/link";
import { getDevSummoners } from "@/lib/api";
import { formatTimeAgo, formatUtcDateTime } from "@/lib/format";
import { summonerPath } from "@/lib/riot-id";

export const metadata: Metadata = {
  title: "Dev · Arena Journey",
};

// A debug view of the database: always read it fresh.
export const dynamic = "force-dynamic";

const HEADER = "px-3 py-2 text-left text-[11px] font-normal tracking-[.24em] text-lol-gold-300";
const CELL = "px-3 py-2 whitespace-nowrap";

/**
 * Every summoner with a recap (matches fetched at least once), latest
 * refresh first, for debugging ingestion. Public, like the rest of the site,
 * and linked from nowhere.
 */
export default async function DevPage() {
  const { total, summoners, readAt } = await getDevSummoners();

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center bg-lol-navy-950 px-4 sm:px-10">
      <div className="w-full max-w-5xl py-12 sm:py-16">
        <Link
          href="/"
          className="text-[11px] tracking-[.3em] text-lol-gold-300 transition-colors hover:text-lol-gold-100"
        >
          ← BACK TO SEARCH
        </Link>
        <h1 className="mt-8 font-display text-4xl tracking-[.08em] text-lol-gold-50">RECAPS</h1>
        <p className="mt-2 text-sm text-lol-text-secondary">
          {summoners.length < total
            ? `The ${summoners.length} most recently refreshed of ${total} summoners with a recap.`
            : `${total} summoner${total === 1 ? "" : "s"} with a recap, most recently refreshed first.`}{" "}
          Matches counts every stored game, broken ones included.
        </p>

        <div className="mt-8 overflow-x-auto border border-[rgba(200,170,110,.25)]">
          <table className="w-full text-sm text-lol-gold-100 tabular-nums">
            <thead className="border-b border-[rgba(200,170,110,.35)] bg-[rgba(10,50,60,.35)]">
              <tr>
                <th className={HEADER}>NAME</th>
                <th className={HEADER}>TAG</th>
                <th className={HEADER}>PLATFORM</th>
                <th className={HEADER}>REGION</th>
                <th className={`${HEADER} text-right`}>MATCHES</th>
                <th className={HEADER}>LAST UPDATED</th>
              </tr>
            </thead>
            <tbody>
              {summoners.map((summoner) => (
                <tr
                  key={`${summoner.platform}/${summoner.gameName}#${summoner.tagLine}/${summoner.lastRefreshedAt}`}
                  className="border-b border-[rgba(200,170,110,.1)] last:border-0 hover:bg-[rgba(10,50,60,.35)]"
                >
                  <td className={CELL}>
                    <Link
                      href={summonerPath(summoner.platform, summoner.gameName, summoner.tagLine)}
                      className="text-lol-gold-50 underline-offset-4 hover:underline"
                    >
                      {summoner.gameName}
                    </Link>
                  </td>
                  <td className={`${CELL} text-lol-text-secondary`}>#{summoner.tagLine}</td>
                  <td className={CELL}>{summoner.platform.toUpperCase()}</td>
                  <td className={`${CELL} text-lol-text-secondary`}>{summoner.region}</td>
                  <td className={`${CELL} text-right`}>{summoner.matchCount.toLocaleString("en-US")}</td>
                  <td className={CELL}>
                    {formatTimeAgo(readAt - Date.parse(summoner.lastRefreshedAt))}
                    <span className="ml-2 text-xs text-lol-text-muted">
                      {formatUtcDateTime(summoner.lastRefreshedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
