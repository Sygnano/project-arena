"use client";

import type { ReactNode } from "react";
import type { ChampionGames } from "@arena/types";
import { championIconUrl } from "@/utils/riot";
import { useChampionName } from "@/features/recap/stores/champion-names";

/** Champion icons, each with its name and a count underneath ("games" by
 * default; `noun` for other counts, e.g. "kill"). `detail` adds a line under
 * the count. */
function HoverCardChampions<T extends ChampionGames>({
  champions,
  noun = "game",
  detail,
}: {
  champions: readonly T[];
  noun?: string;
  detail?: (champion: T) => ReactNode;
}) {
  const championName = useChampionName();
  return (
    <div className="flex gap-3">
      {champions.map((champion) => (
        <div key={champion.championName} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={championIconUrl(champion.championName)}
            alt=""
            className="size-9 border border-[rgba(200,170,110,.4)]"
          />
          <div className="w-full truncate text-center font-display text-[11px] text-lol-gold-50">
            {championName(champion.championName)}
          </div>
          <div className="text-[10px] text-lol-text-muted">
            {champion.games} {noun}
            {champion.games === 1 ? "" : "s"}
          </div>
          {detail ? <div className="text-[10px] tracking-[.08em] text-lol-text-muted">{detail(champion)}</div> : null}
        </div>
      ))}
    </div>
  );
}

export { HoverCardChampions };
