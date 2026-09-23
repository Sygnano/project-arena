import type { FastifyReply } from "fastify";
import type { RefreshEvent } from "@arena/types";

/** Proxies drop an idle connection; a comment line every 15s keeps it open. */
const HEARTBEAT_MS = 15_000;

type EventName = RefreshEvent["event"];
type EventData<E extends EventName> = Extract<RefreshEvent, { event: E }>["data"];

export interface EventStream {
  /** False once the client has gone. Sends after that are dropped. */
  readonly open: boolean;
  send<E extends EventName>(event: E, data: EventData<E>): void;
  /** Sends an event whose data is already serialized (the cached stats JSON). */
  sendJson(event: EventName, json: string): void;
  /** Runs `handler` when the client goes, or right away if it already has. */
  onClose(handler: () => void): void;
  end(): void;
}

/** Every stream still open, so a shutdown can end them (`endAllEventStreams`). */
const openStreams = new Set<EventStream>();

/**
 * Ends every open stream with an `unavailable` error. For shutdown: the
 * server only closes once its connections have, and a stream following a
 * long fetch would otherwise hold it open. The fetch itself isn't stopped
 * here; whatever it stored is kept.
 */
export function endAllEventStreams() {
  for (const stream of openStreams) {
    stream.send("error", { code: "unavailable" });
    stream.end();
  }
}

/**
 * Turns the reply into a server-sent event stream (`text/event-stream`).
 * Takes the response over from Fastify (`hijack`), so the route writes the
 * events itself and must call `end()`.
 */
export function openEventStream(reply: FastifyReply): EventStream {
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    // Keeps nginx-style proxies from buffering the events.
    "x-accel-buffering": "no",
  });

  let open = true;
  const closeHandlers: (() => void)[] = [];
  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), HEARTBEAT_MS);
  res.on("close", () => {
    open = false;
    clearInterval(heartbeat);
    openStreams.delete(stream);
    for (const handler of closeHandlers) handler();
  });

  // JSON never contains a raw newline, so each event's data fits one `data:` line.
  const write = (event: EventName, json: string) => {
    if (open) res.write(`event: ${event}\ndata: ${json}\n\n`);
  };

  const stream: EventStream = {
    get open() {
      return open;
    },
    send: (event, data) => write(event, JSON.stringify(data)),
    sendJson: write,
    // A client that left during an earlier step (the Riot lookup) already
    // fired `close`: a handler added now would never run, and the refresh
    // would hold the visitor's stream slot until the whole fetch ended.
    onClose: (handler) => {
      if (open) closeHandlers.push(handler);
      else handler();
    },
    end: () => {
      clearInterval(heartbeat);
      openStreams.delete(stream);
      if (open) res.end();
    },
  };
  openStreams.add(stream);
  return stream;
}
