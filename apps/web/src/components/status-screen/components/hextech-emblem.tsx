import type { ReactNode } from "react";

/** The turning rings + breathing diamond shared by the loading and queue
 * screens (`features/recap/components/recap-loading` introduced it). */
function HextechEmblem({ children }: { children?: ReactNode }) {
  return (
    <div aria-hidden className="relative h-40 w-40">
      <div className="welcome-spin-slow absolute inset-0 rounded-full border border-dashed border-[rgba(200,170,110,.38)]" />
      <div className="welcome-spin-reverse absolute inset-5 rotate-45 border border-[rgba(200,170,110,.45)]" />
      {children ?? <div className="dial-breathe absolute inset-[62px] rotate-45 bg-lol-gold-300/70" />}
    </div>
  );
}

export { HextechEmblem };
