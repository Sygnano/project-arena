/** One server-sent event, its data parsed as JSON. */
export interface ServerSentEvent {
  event: string;
  data: unknown;
}

/** Turns one event block (the lines between blank lines) into an event. Comments (`: ...`) are skipped. */
function parseBlock(block: string): ServerSentEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(line.startsWith("data: ") ? 6 : 5));
  }
  return data.length > 0 ? { event, data: JSON.parse(data.join("\n")) } : null;
}

/**
 * Reads a `text/event-stream` body event by event. `onChunk` runs on every
 * chunk received, heartbeats included (the caller's idle timeout). A match
 * timeline arrives as one ~1.5 MB event, so the search for its end resumes
 * where the last chunk's search stopped rather than from the start.
 */
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
  onChunk: () => void,
): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let searchFrom = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      onChunk();
      // The gateway writes "\n" line ends only, so blocks end at "\n\n".
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const end = buffer.indexOf("\n\n", searchFrom);
        if (end === -1) {
          searchFrom = Math.max(0, buffer.length - 1);
          break;
        }
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        searchFrom = 0;
        const event = parseBlock(block);
        if (event) yield event;
      }
    }
  } finally {
    // Closes the connection when the caller stops early (the answer is in).
    await reader.cancel().catch(() => {});
  }
}
