"use client";

import type { EconomyStats, ItemOutcomeStats, PrismaticItemPicksStats, PrismaticItemsStats } from "@arena/types";
import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/animated-number";
import { Appear } from "@/components/appear";
import { StoryComb } from "@/features/recap/components/story-comb";
import { Em, StoryFrame, StoryKicker, StoryText, StoryTitle } from "@/features/recap/components/story-frame";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { formatGold } from "@/utils/format";
import { winningPrismaticCells } from "./utils";

type Props = {
  economy: EconomyStats;
  prismaticItems: PrismaticItemsStats;
  prismaticItemPicks: PrismaticItemPicksStats;
  specialItems: ItemOutcomeStats[];
};

const games = (count: number) => `${count} ${count === 1 ? "game" : "games"}`;

/** Story slide: the shopping. Items bought and gold earned, the Prismatic
 * items that were part of a win, the Shardblades (the rare one, shown off)
 * and the special upgrades found. */
function StoryItems({ economy, prismaticItems, prismaticItemPicks, specialItems }: Props) {
  const winners = winningPrismaticCells(prismaticItems, prismaticItemPicks);
  const shardblade = economy.shardblade;
  const upgrades = specialItems.filter((item) => item.timesPicked > 0);

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.prismaticItemPicks}
      tone={["rgba(200,155,60,.4)", "rgba(120,90,40,.5)"]}
      labelledBy="story-items-title"
      className="justify-center"
    >
      <div className="grid min-h-0 flex-1 items-center gap-[clamp(14px,3vh,40px)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        {winners.length > 0 ? (
          <StoryComb
            cells={winners}
            className="order-last h-[clamp(120px,24vh,560px)] w-full lg:order-first lg:h-full lg:max-h-[66vh]"
          />
        ) : null}
        <div>
          <StoryKicker>ITEMS</StoryKicker>
          <StoryTitle id="story-items-title">
            <AnimatedNumber value={economy.itemsPurchased} className="text-lol-gold-200" durationMs={1400} /> items
            bought.
          </StoryTitle>
          <StoryText>
            Paid for with <Em>{formatGold(economy.totalGoldEarned)}</Em> gold earned.{" "}
            {winners.length > 0 ? (
              <>
                And <Em>{winners.length}</Em> different Prismatic items were in your hands for a win.
              </>
            ) : null}
          </StoryText>

          {shardblade.timesPicked > 0 ? (
            <Appear delay={1.1} from="left" className="mt-[clamp(14px,3vh,32px)]">
              <div className="flex items-center gap-[clamp(14px,2vw,24px)] border border-[rgba(200,155,60,.6)] bg-[linear-gradient(100deg,rgba(200,155,60,.22),rgba(4,12,20,.4))] py-[clamp(8px,1.6vh,16px)] pr-6 pl-[clamp(8px,1.6vh,16px)] shadow-[0_0_40px_rgba(200,155,60,.25)]">
                <motion.img
                  src={shardblade.iconUrl}
                  alt=""
                  width={88}
                  height={88}
                  className="size-[clamp(56px,10vh,88px)] border-2 border-[#d4ab62] shadow-[0_0_28px_rgba(212,171,98,.55)]"
                  initial={{ rotate: -12, scale: 0.6 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 1.2, type: "spring", stiffness: 200, damping: 12 }}
                />
                <div>
                  <div className="flex items-baseline gap-2.5">
                    <AnimatedNumber
                      value={shardblade.timesPicked}
                      className="font-display text-[clamp(34px,min(5vw,8vh),60px)] leading-none text-[#e6c27a]"
                    />
                    <span className="font-display text-[clamp(15px,1.8vw,22px)] tracking-[.12em] text-lol-gold-50">
                      {shardblade.timesPicked === 1 ? "SHARDBLADE" : "SHARDBLADES"}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] text-lol-text-secondary">
                    Your stat shards, supercharged. Wins in {shardblade.top3} of those {games(shardblade.timesPicked)}.
                  </div>
                </div>
              </div>
            </Appear>
          ) : null}

          {upgrades.length > 0 ? (
            <Appear delay={1.5} className="mt-[clamp(12px,2.5vh,24px)]">
              <div className="text-[10px] tracking-[.3em] text-lol-text-muted">SPECIAL UPGRADES</div>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {upgrades.map((item) => (
                  <li key={item.itemId} className="flex items-center gap-2.5">
                    <img
                      src={item.iconUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 border border-[rgba(200,170,110,.4)]"
                    />
                    <span className="text-[13px] leading-tight">
                      <span className="block text-lol-gold-50">{item.itemName}</span>
                      <span className="text-lol-text-muted">{games(item.timesPicked)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Appear>
          ) : null}
        </div>
      </div>
    </StoryFrame>
  );
}

export { StoryItems };
