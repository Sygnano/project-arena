"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RefreshErrorCode, RefreshEvent, RefreshProgress, SummonerView } from "@arena/types";
import { summonerStatsQueryKey } from "@/lib/summoner-query";
import { summonerPath } from "@/lib/riot-id";

export type SummonerRefreshState =
  | { status: "idle" }
  /** `summoner` once resolved, `progress` once queued. */
  | { status: "running"; summoner: SummonerView | null; progress: RefreshProgress | null }
  /** The new recap is in the query cache. */
  | { status: "done"; summoner: SummonerView }
  | { status: "error"; code: RefreshErrorCode; retryAfterSeconds?: number; summoner: SummonerView | null };

type Options = {
  platform: string;
  gameName: string;
  tagLine: string;
  /** Joins a fetch already running (someone else started it) on mount. */
  autoStart?: boolean;
};

/** Splits a server-sent event stream into `{ event, data }` messages. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<RefreshEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = "";
      let data = "";
      for (const line of block.split("\n")) {
        // Lines starting with ":" are the server's keep-alive comments.
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (event && data) yield { event, data: JSON.parse(data) } as RefreshEvent;
    }
  }
}

/**
 * The summoner page's refresh: `start()` opens the API's event stream (the
 * only path that reaches Riot) and follows it to the end. Resolving the Riot
 * ID, the queue, match by match, then the recap, which goes straight into the
 * query cache the recap view reads. Leaving the page closes the stream; the
 * fetch carries on in the API and pressing again joins it.
 */
export function useSummonerRefresh({ platform, gameName, tagLine, autoStart = false }: Options) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SummonerRefreshState>(
    autoStart ? { status: "running", summoner: null, progress: null } : { status: "idle" },
  );
  const controller = useRef<AbortController | null>(null);

  /** Opens the stream and follows it; every state change happens as events arrive. */
  const connect = useCallback(() => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;

    void (async () => {
      let summoner: SummonerView | null = null;
      try {
        const res = await fetch(`/api${summonerPath(platform, gameName, tagLine)}/refresh`, {
          method: "POST",
          signal: abort.signal,
        });
        if (!res.ok || !res.body) {
          setState({ status: "error", code: res.status === 400 ? "not_found" : "unavailable", summoner });
          return;
        }
        for await (const message of readEvents(res.body)) {
          switch (message.event) {
            case "summoner":
              summoner = message.data;
              setState((current) =>
                current.status === "running" ? { ...current, summoner: message.data } : current,
              );
              break;
            case "progress":
              setState((current) =>
                current.status === "running" ? { ...current, progress: message.data } : current,
              );
              break;
            case "stats":
              queryClient.setQueryData(summonerStatsQueryKey(platform, gameName, tagLine), message.data);
              break;
            case "error":
              setState({ status: "error", code: message.data.code, retryAfterSeconds: message.data.retryAfterSeconds, summoner });
              return;
            case "done":
              if (summoner) setState({ status: "done", summoner });
              return;
          }
        }
        // The stream closed without an ending: the connection dropped.
        setState({ status: "error", code: "unavailable", summoner });
      } catch {
        if (!abort.signal.aborted) setState({ status: "error", code: "unavailable", summoner });
      }
    })();
  }, [platform, gameName, tagLine, queryClient]);

  const start = useCallback(() => {
    setState({ status: "running", summoner: null, progress: null });
    connect();
  }, [connect]);

  useEffect(() => {
    if (autoStart) connect();
    return () => controller.current?.abort();
    // Only on mount: joining a running fetch is a one-time decision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, start };
}

/** Whether a fetch is waiting or running. */
export function isRefreshActive(progress: RefreshProgress | null | undefined) {
  return progress?.state === "queued" || progress?.state === "running";
}
