import type { ReactNode } from "react";
import type { RefreshProgress } from "@arena/types";
import { StatusScreen } from "@/components/status-screen";
import { MatchProgressBar } from "./match-progress-bar";
import { ProgressEmblem } from "./progress-emblem";
import { describeProgress } from "@/features/recap/components/refresh-view/utils";

type Props = {
  title: ReactNode;
  /** The platform's display name. */
  server: string;
  progress: RefreshProgress | null;
};

/** A running fetch: Riot ID lookup, queue position, then match by match with an ETA. */
function FetchingScreen({ title, server, progress }: Props) {
  const { eyebrow, detail, fraction, matches } = describeProgress(progress, server);
  return (
    <StatusScreen busy eyebrow={eyebrow} title={title} emblem={<ProgressEmblem fraction={fraction} />}>
      <p aria-live="polite" className="text-lol-gold-100 tabular-nums">
        {detail}
      </p>
      {matches ? <MatchProgressBar done={matches.done} total={matches.total} /> : null}
      <p className="mt-6 text-sm text-lol-text-muted">
        Riot limits how fast matches can be fetched, so a first visit can take a while. Keep this tab open, or share the
        link: it shows the recap once it&apos;s ready.
      </p>
    </StatusScreen>
  );
}

export { FetchingScreen };
