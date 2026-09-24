import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "About · Arena Journey",
};

/** Riot's required disclaimer, plus where the game data and art come from. */
export default function AboutPage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center bg-lol-navy-950 px-4 sm:px-10">
      <div className="w-full max-w-2xl flex-1 py-16 sm:py-24">
        <Link
          href="/"
          className="text-[11px] tracking-[.3em] text-lol-gold-300 transition-colors hover:text-lol-gold-100"
        >
          ← BACK TO SEARCH
        </Link>
        <h1 className="mt-8 font-display text-4xl tracking-[.08em] text-lol-gold-50 sm:text-5xl">ABOUT</h1>

        <h2 className="mt-10 text-[12px] tracking-[.36em] text-lol-gold-300">RIOT GAMES DISCLAIMER</h2>
        <p className="mt-3 leading-relaxed text-lol-text-secondary">
          Arena Journey isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games
          or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
          properties are trademarks or registered trademarks of Riot Games, Inc.
        </p>

        <h2 className="mt-10 text-[12px] tracking-[.36em] text-lol-gold-300">DATA &amp; ASSETS</h2>
        <p className="mt-3 leading-relaxed text-lol-text-secondary">
          Match data comes from the{" "}
          <a
            href="https://developer.riotgames.com/"
            target="_blank"
            rel="noreferrer"
            className="text-lol-blue-200 underline-offset-4 hover:underline"
          >
            Riot Games API
          </a>
          . Champion, item and profile icon art comes from Riot&apos;s Data Dragon, and Arena augment data and art from{" "}
          <a
            href="https://www.communitydragon.org/"
            target="_blank"
            rel="noreferrer"
            className="text-lol-blue-200 underline-offset-4 hover:underline"
          >
            Community Dragon
          </a>
          . League of Legends and all related art, names and fonts belong to Riot Games, Inc.
        </p>
      </div>
      <SiteFooter className="pb-6" />
    </main>
  );
}
