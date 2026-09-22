import { NewSearchLink, StatusScreen } from "@/components/status-screen";

/**
 * Any URL no route matches (`/foo`, `/summoner/euw1`). Malformed summoner
 * slugs have their own page (`app/summoner/[platform]/[riotId]/not-found.tsx`).
 */
export default function NotFound() {
  return (
    <StatusScreen eyebrow="LOST IN THE ARENA" title="PAGE NOT FOUND" actions={<NewSearchLink />}>
      <p className="text-lol-text-secondary">
        There&apos;s nothing at this address. Search for a summoner to find their recap.
      </p>
    </StatusScreen>
  );
}
