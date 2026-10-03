import type { RefreshErrorCode } from "@arena/types";
import type { ReactNode } from "react";
import { actionClass, NewSearchLink, StatusScreen } from "@/components/status-screen";
import { formatRetryAfter } from "@/features/recap/api/summoner-query";

type Props = {
  code: RefreshErrorCode;
  retryAfterSeconds?: number;
  title: ReactNode;
  /** The platform's display name. */
  server: string;
  onRetry: () => void;
};

/** Why a fetch couldn't start or finish, with a retry where one can help. */
function RefreshError({ code, retryAfterSeconds, title, server, onRetry }: Props) {
  const retry = (
    <>
      <button type="button" onClick={onRetry} className={actionClass}>
        TRY AGAIN
      </button>
      <NewSearchLink className="border-[rgba(200,170,110,.3)] text-lol-text-secondary" />
    </>
  );

  switch (code) {
    case "not_found":
      return (
        <StatusScreen eyebrow="NO SUCH SUMMONER" title={title} actions={<NewSearchLink />}>
          <p className="text-lol-text-secondary">
            Riot has no summoner with this Riot ID on {server}. Check the spelling and the server.
          </p>
        </StatusScreen>
      );
    case "rate_limited":
    case "busy":
      return (
        <StatusScreen eyebrow="HOLD ON" title={title} actions={retry}>
          <p className="text-lol-text-secondary">
            {code === "busy"
              ? "Too many fetches are running right now. Try again in a few minutes."
              : `Too many fetches from your connection. Try again ${formatRetryAfter(retryAfterSeconds ?? 60)}.`}
          </p>
        </StatusScreen>
      );
    default:
      return (
        <StatusScreen
          eyebrow={code === "failed" ? "THE FORGE STALLED" : "SOMETHING WENT WRONG"}
          title={title}
          actions={retry}
        >
          <p className="text-lol-text-secondary">
            {code === "failed"
              ? "Fetching matches from Riot failed partway. Matches already fetched are kept, so trying again picks up where it stopped."
              : "The stats service didn't respond. It may be restarting — try again in a moment."}
          </p>
        </StatusScreen>
      );
  }
}

export { RefreshError };
