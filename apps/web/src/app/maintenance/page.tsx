import type { Metadata } from "next";
import Link from "next/link";
import { actionClass, StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = {
  title: "Maintenance · Arena Journey",
};

/**
 * Where `proxy.ts` sends every page while `MAINTENANCE_MODE` is on. TRY AGAIN goes home, which
 * lands back here until maintenance is over.
 */
export default function MaintenancePage() {
  return (
    <StatusScreen
      eyebrow="BACK SOON"
      title="UNDER MAINTENANCE"
      actions={
        <Link href="/" className={actionClass}>
          TRY AGAIN
        </Link>
      }
    >
      <p className="text-lol-text-secondary">
        We&apos;re moving the arena to a new home. Recaps will be back shortly, with every match still in them.
      </p>
    </StatusScreen>
  );
}
