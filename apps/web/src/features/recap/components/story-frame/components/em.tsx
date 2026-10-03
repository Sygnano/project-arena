import { cn } from "cn";
import type { ReactNode } from "react";

/** A figure or name picked out inside story text. */
function Em({ children, className }: { children: ReactNode; className?: string }) {
  return <strong className={cn("font-semibold text-lol-gold-100", className)}>{children}</strong>;
}

export { Em };
