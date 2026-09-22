import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "cn";
import { SiteFooter } from "@/components/site-footer";

type Props = {
  /** Visual above the text; defaults to the turning hextech emblem. */
  emblem?: ReactNode;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  /** Buttons/links under the text. */
  actions?: ReactNode;
  busy?: boolean;
};

/** The turning rings + breathing diamond shared by the loading and queue
 * screens (`app/summoner/.../loading.tsx` introduced it). */
function HextechEmblem({ children }: { children?: ReactNode }) {
  return (
    <div aria-hidden className="relative h-40 w-40">
      <div className="welcome-spin-slow absolute inset-0 rounded-full border border-dashed border-[rgba(200,170,110,.38)]" />
      <div className="welcome-spin-reverse absolute inset-5 rotate-45 border border-[rgba(200,170,110,.45)]" />
      {children ?? <div className="dial-breathe absolute inset-[62px] rotate-45 bg-lol-gold-300/70" />}
    </div>
  );
}

/**
 * A centered, full-screen message in the summoner pages' style: emblem,
 * letter-spaced eyebrow, Beaufort title, body and actions, over the site
 * footer (the about link). Used by the queue, "no recap yet", "no Arena
 * games", 404 and error screens.
 */
function StatusScreen({ emblem, eyebrow, title, children, actions, busy }: Props) {
  return (
    <main
      aria-busy={busy || undefined}
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-lol-navy-950 px-6 pt-20 pb-20 text-center"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 40%, rgba(10,50,60,.35) 0%, rgba(5,14,22,0) 70%)",
        }}
      />
      <div className="splash-rise relative">{emblem ?? <HextechEmblem />}</div>
      <p
        className="splash-rise relative mt-10 text-[12px] tracking-[.42em] text-lol-gold-300"
        style={{ animationDelay: "100ms" }}
      >
        {eyebrow}
      </p>
      <h1
        className="splash-rise relative mt-4 font-display text-3xl tracking-[.04em] text-lol-gold-50 sm:text-4xl"
        style={{ animationDelay: "160ms" }}
      >
        {title}
      </h1>
      <div className="splash-rise relative mt-4 w-full max-w-md" style={{ animationDelay: "220ms" }}>
        {children}
      </div>
      {actions ? (
        <div
          className="splash-rise relative mt-8 flex flex-wrap justify-center gap-3"
          style={{ animationDelay: "280ms" }}
        >
          {actions}
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 pb-6">
        <SiteFooter />
      </div>
    </main>
  );
}

const actionClass =
  "border border-[rgba(200,170,110,.55)] px-5 py-2.5 text-[12px] tracking-[.26em] text-lol-gold-100 transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50";

/** The secondary "back to search" action most status screens offer. */
function NewSearchLink({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn(actionClass, className)}>
      NEW SEARCH
    </Link>
  );
}

export { StatusScreen, HextechEmblem, NewSearchLink, actionClass };
