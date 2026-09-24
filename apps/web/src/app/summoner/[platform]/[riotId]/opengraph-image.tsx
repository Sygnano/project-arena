import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { SummonerView } from "@arena/types";
import { getSummonerPage } from "@/lib/api";
import { formatUtcDateTime } from "@/lib/format";
import { isKnownPlatform, platformRegionName, profileIconUrl } from "@/lib/riot";
import { parseRiotIdSlug } from "@/lib/riot-id";

export const alt = "Arena season recap";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#c8aa6e";
const GOLD_LIGHT = "#f0e6d2";
const MUTED = "#a09b8c";
const CYAN = "#0ac8b9";

// Rendered cards (~150 KB each), least recently used first. A card is ~70 ms
// of this server's CPU plus a Data Dragon download; chat apps and bots ask
// for the same one again and again. Keyed by everything the card shows, so a
// refresh or a new icon renders a new one.
const MAX_CACHED_CARDS = 100;
const cards = new Map<string, ArrayBuffer>();

function png(bytes: ArrayBuffer) {
  return new Response(bytes, { headers: { "content-type": "image/png" } });
}

/** The icon as a data URL, or null: a failed icon download must not fail
 * the whole card. */
async function loadIcon(profileIconId: number | null): Promise<string | null> {
  if (profileIconId === null) return null;
  try {
    const res = await fetch(profileIconUrl(profileIconId));
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The summoner link's preview card (Discord, X, iMessage...): profile icon,
 * Riot ID, server, and when the matches were last fetched — "never" for a
 * summoner nobody has fetched yet. A Riot ID that isn't stored gets a
 * generic card: naming it would let any URL put its own text on a card
 * under this site's name (and give every made-up name its own render).
 */
export default async function Image({ params }: { params: Promise<{ platform: string; riotId: string }> }) {
  const { platform, riotId } = await params;
  const parsed = parseRiotIdSlug(riotId);
  const known = parsed !== null && isKnownPlatform(platform);
  const summoner: SummonerView | null = known
    ? ((await getSummonerPage(platform, parsed.gameName, parsed.tagLine).catch(() => null))?.summoner ?? null)
    : null;

  // An unknown platform segment would be echoed as is: left off instead.
  const server = known ? platformRegionName(platform).toUpperCase() : null;
  const cacheKey = JSON.stringify([server, summoner]);
  const cached = cards.get(cacheKey);
  if (cached) {
    cards.delete(cacheKey);
    cards.set(cacheKey, cached);
    return png(cached);
  }

  const fontDir = join(process.cwd(), "src/fonts");
  const [beaufort, spiegel, icon] = await Promise.all([
    readFile(join(fontDir, "beaufort/beaufortforlol-bold.otf")),
    readFile(join(fontDir, "spiegel/spiegel-semibold.otf")),
    loadIcon(summoner?.profileIconId ?? null),
  ]);

  const gameName = summoner?.gameName ?? "Season recap";
  const tagLine = summoner?.tagLine ?? "";
  const updated = summoner?.lastRefreshedAt
    ? `LAST UPDATED ${formatUtcDateTime(summoner.lastRefreshedAt).toUpperCase()}`
    : "LAST UPDATED · NEVER";

  const image = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(70% 80% at 50% 40%, #0a323c 0%, #091428 55%, #010a13 100%)",
        fontFamily: "Spiegel",
        color: GOLD_LIGHT,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 28,
          right: 28,
          bottom: 28,
          border: `1px solid rgba(200,170,110,.35)`,
          display: "flex",
        }}
      />
      <div style={{ display: "flex", fontSize: 22, letterSpacing: 10, color: GOLD }}>ARENA JOURNEY</div>

      <div style={{ display: "flex", alignItems: "center", marginTop: 44 }}>
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" width={150} height={150} style={{ border: `2px solid ${GOLD}`, marginRight: 44 }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Beaufort" }}>
            <span style={{ fontSize: 84, lineHeight: 1 }}>{gameName}</span>
            {tagLine ? <span style={{ fontSize: 44, color: MUTED, marginLeft: 16 }}>#{tagLine}</span> : null}
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 24, letterSpacing: 6, color: MUTED }}>
            {server ? `ARENA SEASON RECAP · ${server}` : "ARENA SEASON RECAP"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", marginTop: 56 }}>
        <div style={{ width: 120, height: 1, background: `linear-gradient(270deg, ${GOLD}, transparent)` }} />
        {summoner && summoner.lastRefreshedAt && summoner.matchCount > 0 ? (
          <div style={{ display: "flex", alignItems: "baseline", margin: "0 28px" }}>
            <span style={{ fontFamily: "Beaufort", fontSize: 56, color: GOLD_LIGHT }}>
              {summoner.matchCount.toLocaleString("en-US")}
            </span>
            <span style={{ fontSize: 22, letterSpacing: 6, color: MUTED, marginLeft: 14 }}>
              {summoner.matchCount === 1 ? "ARENA GAME" : "ARENA GAMES"}
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              margin: "0 28px",
              width: 10,
              height: 10,
              background: CYAN,
              transform: "rotate(45deg)",
            }}
          />
        )}
        <div style={{ width: 120, height: 1, background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
      </div>

      <div style={{ display: "flex", marginTop: 26, fontSize: 20, letterSpacing: 5, color: CYAN }}>{updated}</div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Beaufort", data: beaufort, weight: 700, style: "normal" },
        { name: "Spiegel", data: spiegel, weight: 600, style: "normal" },
      ],
    },
  );
  const bytes = await image.arrayBuffer();
  cards.set(cacheKey, bytes);
  if (cards.size > MAX_CACHED_CARDS) cards.delete(cards.keys().next().value!);
  return png(bytes);
}
