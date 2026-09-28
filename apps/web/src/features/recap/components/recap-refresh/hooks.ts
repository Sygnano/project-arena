import { useSyncExternalStore } from "react";
import { MINUTE_MS } from "./constants";

// A clock that ticks once a minute, so the button appears when the data
// turns stale on an open page. Null on the server (no "now" to hydrate).
function subscribeToClock(onChange: () => void) {
  const id = setInterval(onChange, MINUTE_MS / 2);
  return () => clearInterval(id);
}
const readClock = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
const readServerClock = () => null;

function useMinuteClock(): number | null {
  return useSyncExternalStore(subscribeToClock, readClock, readServerClock);
}

export { useMinuteClock };
