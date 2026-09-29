import type { PingBreakdown } from "@arena/types";

// Riot's in-game minimap ping-wheel/UX assets — the same "verified against a
// real directory listing" approach as `TeamSlot.tsx`'s team crests, since
// this mapping (Riot ping-type key -> icon file) isn't published anywhere
// either. Confirmed each file exists at
// https://raw.communitydragon.org/latest/game/assets/ux/minimap/pings/.
// Most map cleanly onto the current 8-way ping wheel (see
// wiki.leagueoflegends.com/en-us/Ping): retreat/push/onMyWay/allIn/assistMe/
// needVision/enemyMissing/enemyVision. `danger` is the default-click
// "Caution" ping, `getBack` a separate legacy counter from `retreat` (Riot
// really does track both, confirmed distinct nonzero totals in real data).
// `basic`/`command` are murkier: per the wiki both are "removed historical"
// ping types predating the current wheel, yet Riot's API still counts them.
// Checked against every tracked match's real `pings` data (5,994 participant
// rows): `basic` is 0 across every single one, while `command` is actually
// the *second most common* type overall (6,430) — almost certainly the
// modern client is routing today's default click-to-ping through the
// `command` counter, not `basic`. Icon assignments below follow that
// evidence: `command` gets the generic ping marker, `basic`/`hold`/
// `visionCleared` (also always 0 in real data) get a best-effort icon since
// there's no usage to confirm against.
const PING_ICON_FILE: Record<keyof PingBreakdown, string> = {
  allIn: "all_in.png",
  assistMe: "assist.png",
  basic: "target.png",
  command: "ping.png",
  danger: "caution.png",
  enemyMissing: "mia_new.png",
  enemyVision: "area_is_warded_small_red_new.png",
  getBack: "get_back_small.png",
  hold: "hold.png",
  needVision: "need_ward.png",
  onMyWay: "on_my_way_new.png",
  push: "push.png",
  retreat: "retreat.png",
  visionCleared: "cleared.png",
};

const PING_LABEL: Record<keyof PingBreakdown, string> = {
  allIn: "All In",
  assistMe: "Assist Me",
  basic: "Basic",
  command: "Generic Ping",
  danger: "Danger",
  enemyMissing: "Enemy Missing",
  enemyVision: "Enemy Vision",
  getBack: "Get Back",
  hold: "Hold",
  needVision: "Need Vision",
  onMyWay: "On My Way",
  push: "Push",
  retreat: "Retreat",
  visionCleared: "Vision Cleared",
};

export { PING_ICON_FILE, PING_LABEL };
