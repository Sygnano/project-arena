import type { ReactNode } from "react";
import { NewSearchLink, StatusScreen, actionClass } from "@/components/status-screen";
import { SummonerEmblem } from "./summoner-emblem";

type Props = {
  title: ReactNode;
  /** The platform's display name. */
  server: string;
  profileIconId: number | null;
  onStart: () => void;
};

/** "Last updated: never" and the FETCH MATCHES button: nothing is asked of Riot until it's pressed. */
function FetchPrompt({ title, server, profileIconId, onStart }: Props) {
  return (
    <StatusScreen
      eyebrow="NO RECAP YET"
      title={title}
      emblem={<SummonerEmblem profileIconId={profileIconId} />}
      actions={
        <>
          <button type="button" onClick={onStart} className={actionClass}>
            FETCH MATCHES
          </button>
          <NewSearchLink className="border-[rgba(200,170,110,.3)] text-lol-text-secondary" />
        </>
      }
    >
      <p className="text-[12px] tracking-[.26em] text-lol-text-muted">LAST UPDATED · NEVER</p>
      <p className="mt-4 text-lol-text-secondary">
        This summoner&apos;s Arena matches haven&apos;t been fetched from {server} yet. Fetch them to build their season
        recap.
      </p>
    </StatusScreen>
  );
}

export { FetchPrompt };
