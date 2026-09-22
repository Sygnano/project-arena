import Link from "next/link";
import { cn } from "cn";

/**
 * The footer of the splash, about and status screens: one link to the about page, which
 * holds the Riot Games disclaimer every Riot API product has to show.
 */
function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("relative w-full text-center", className)}>
      <Link
        href="/about"
        className="text-[11px] tracking-[.24em] text-lol-text-muted uppercase transition-colors hover:text-lol-gold-100"
      >
        About
      </Link>
    </footer>
  );
}

export { SiteFooter };
