import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/**
 * The viewer's offset from UTC in hours (+2 in Paris in summer, −5 in New
 * York in winter, 5.5 in India), today's, so daylight saving follows the
 * date. 0 on the server and while hydrating: the server has no idea where
 * the viewer is, so the page first renders in UTC, then switches.
 */
export function useUtcOffsetHours(): number {
  return useSyncExternalStore(
    noSubscription,
    () => -new Date().getTimezoneOffset() / 60,
    () => 0,
  );
}
