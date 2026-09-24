import type { FastifyReply } from "fastify";
import type { GatewayEvent } from "@arena/riot";

/** Proxies drop an idle connection, and the client gives up after 45s of
 * silence: a comment line every 15s keeps a waiting request's stream alive. */
const HEARTBEAT_MS = 15_000;

type EventName = GatewayEvent["event"];
type EventData<E extends EventName> = Extract<GatewayEvent, { event: E }>["data"];

export interface EventStream {
  send<E extends EventName>(event: E, data: EventData<E>): void;
  /** Sends an event whose data is already JSON text (Riot's body, verbatim). */
  sendJson(event: EventName, json: string): void;
  /** Runs `handler` when the client goes (not when `end` is called). */
  onClose(handler: () => void): void;
  end(): void;
}

/** Every stream still open, so a shutdown can end them (`endAllEventStreams`). */
const openStreams = new Set<EventStream>();

/**
 * Ends every open stream without an answer, which the client takes as "try
 * again" (see protocol.ts). For shutdown: the server only closes once its
 * connections have, and a request waiting for a crawler's turn could hold it.
 */
export function endAllEventStreams() {
  for (const stream of openStreams) stream.end();
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
    "x-accel-buffering": "no",
  });

  let open = true;
  let ended = false;
  const closeHandlers: (() => void)[] = [];
  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), HEARTBEAT_MS);
  res.on("close", () => {
    open = false;
    clearInterval(heartbeat);
    openStreams.delete(stream);
    if (!ended) for (const handler of closeHandlers) handler();
  });

  // Each event's data must fit one `data:` line. Valid JSON only has raw
  // line breaks as whitespace between tokens (never inside a string), so
  // turning them into spaces keeps it the same JSON.
  const write = (event: EventName, json: string) => {
    if (!open) return;
    const line = json.includes("\n") || json.includes("\r") ? json.replace(/[\r\n]+/g, " ") : json;
    res.write(`event: ${event}\ndata: ${line}\n\n`);
  };

  const stream: EventStream = {
    send: (event, data) => write(event, JSON.stringify(data)),
    sendJson: write,
    onClose: (handler) => {
      if (open) closeHandlers.push(handler);
      else handler();
    },
    end: () => {
      ended = true;
      clearInterval(heartbeat);
      openStreams.delete(stream);
      if (open) res.end();
    },
  };
  openStreams.add(stream);
  return stream;
}
