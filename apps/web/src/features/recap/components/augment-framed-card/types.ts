/**
 * The "framed augment-offer card" look — Riot's own in-game augment-offer
 * card frame art wrapping an icon + name + PICKED/WINS/1ST breakdown, tiered
 * Silver/Gold/Prismatic by how well the summoner has done while holding the
 * augment. First built for `GuestOfHonor`'s champion-exclusive augment lines
 * (Vayne/Kindred/Yone's single-row sets), then pulled out here once
 * `MetaAugments` (Arena's augment-crafting picks) needed the identical
 * card — same shape as `tier-bars.ts`'s own extraction history: build it
 * bespoke once, lift it out once a second real consumer needs the same
 * `{frame, icon, name, stats}` unit rather than re-deriving it.
 */
interface AugmentFramedCardStats {
  augmentId: number;
  augmentName: string;
  iconUrl: string;
  timesPicked: number;
  top1: number;
  top3ExclTop1: number;
}

export type { AugmentFramedCardStats };
