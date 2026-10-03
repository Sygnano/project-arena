import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Section links (`/summoner/.../#augments`) predate the story: they point at
 * the full stats, which used to be this page. The story has no sections, so
 * any hash moves over to the full stats, keeping it.
 */
function useFullStatsHash(advancedHref: string) {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.length > 1) router.replace(`${advancedHref}${hash}`);
  }, [advancedHref, router]);
}

export { useFullStatsHash };
