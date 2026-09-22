"use client";

import Link from "next/link";
import { useRecentRecaps } from "@/lib/recent-recaps";
import { profileIconUrl, SEARCH_PLATFORMS } from "@/lib/riot";
import { summonerPath } from "@/lib/riot-id";

function platformLabel(region: string): string {
  return SEARCH_PLATFORMS.find((platform) => platform.id === region.toLowerCase())?.label ?? region.toUpperCase();
}

/**
 * The splash page's shortcut row: the recaps this browser opened most
 * recently (`lib/recent-recaps.ts`, in localStorage), each a chip (icon,
 * Riot ID, platform) linking straight to that recap. Renders nothing until
 * this browser has opened one.
 */
function RecentRecaps({ className }: { className?: string }) {
  const recaps = useRecentRecaps();
  if (recaps.length === 0) return null;
  return (
    <nav aria-label="Recently viewed recaps" className={className}>
      <p className="text-[10px] tracking-[.32em] text-lol-text-muted sm:text-[11px]">RECENTLY VIEWED</p>
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
        {recaps.map((recap) => (
          <li key={`${recap.region}/${recap.gameName}#${recap.tagLine}`}>
            <Link
              href={summonerPath(recap.region, recap.gameName, recap.tagLine)}
              className="group flex items-center gap-2 border border-[rgba(200,170,110,.25)] bg-[rgba(5,14,22,.6)] py-1 pr-3 pl-1 backdrop-blur-sm transition-colors hover:border-[rgba(200,170,110,.6)] hover:bg-[rgba(10,20,30,.8)] focus-visible:border-lol-gold-300 focus-visible:outline-none"
            >
              {recap.profileIconId != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileIconUrl(recap.profileIconId)}
                  alt=""
                  width={24}
                  height={24}
                  loading="lazy"
                  className="h-6 w-6 flex-none border border-[rgba(200,170,110,.35)]"
                />
              ) : (
                <span aria-hidden className="h-6 w-6 flex-none border border-[rgba(200,170,110,.35)] bg-lol-navy-950" />
              )}
              <span className="text-[13px] text-lol-gold-100 transition-colors group-hover:text-lol-gold-50">
                {recap.gameName}
                <span className="text-lol-text-muted">#{recap.tagLine}</span>
              </span>
              <span className="text-[10px] tracking-[.14em] text-lol-blue-200">{platformLabel(recap.region)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { RecentRecaps };
