import Link from "next/link";
import { cn } from "cn";
import { actionClass } from "@/components/status-screen/constants";

/** The secondary "back to search" action most status screens offer. */
function NewSearchLink({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn(actionClass, className)}>
      NEW SEARCH
    </Link>
  );
}

export { NewSearchLink };
