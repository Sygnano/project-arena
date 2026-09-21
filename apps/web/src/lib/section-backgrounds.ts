const BG = "/images/backgrounds";

/**
 * Background photo per summoner-page section, in page order. Paths point at
 * the web-sized copies in `optimized/` (generated from the full-size art by
 * `scripts/optimize-backgrounds.mjs`, ~13.6 MB -> ~1.7 MB total). Kept in one
 * place so reshuffling the art is a one-file change instead of a hunt
 * through every module. The first and last screens share an image on
 * purpose, to bookend the sequence; there are more sections than images,
 * so the rest are all distinct.
 */
export const SECTION_BACKGROUNDS = {
  welcome: `${BG}/optimized/5eeebc2100709e8321b95ef8256ef1bbc191f3d2-2998x1686.webp`,
  positions: `${BG}/optimized/73039bf73e912ab1c79e73d8bffa7f55b8ca9c04-2849x1634.webp`,
  timePlayed: `${BG}/optimized/0bf381944928996d94386d6a85bc0d7668ef9157-1920x1080.webp`,
  teamSlot: `${BG}/optimized/27fd1033cf923429f0811e355402aecfb00d00cb-1751x1096.webp`,
  kda: "/images/kda-bg.jpg",
  kills: `${BG}/optimized/Pyke_54.webp`,
  // Versus borrows Damage Dealt's art until it has its own.
  versus: `${BG}/optimized/Samira_30.webp`,
  championPicks: `${BG}/optimized/a8b19900f7ed890a98709a7579c73fcb8e9a1176-2877x1618.webp`,
  championGallery: `${BG}/optimized/Gwen_20.webp`,
  champions: `${BG}/optimized/ebd67ca6c72d573f6f73cb2512d53239c2043de3-2524x1326.webp`,
  bannedChampions: `${BG}/optimized/Evelynn_42.webp`,
  damage: `${BG}/optimized/Samira_30.webp`,
  // Damage Curve and Summoner Spells borrow art from other sections too.
  damageCurve: `${BG}/optimized/Pyke_54.webp`,
  damageTaken: `${BG}/optimized/Sett_45.webp`,
  augmentPicks: `${BG}/optimized/340d43b2917973d1a399b652c75b21ef671d9401-1416x1080.webp`,
  augmentHallOfFame: `${BG}/optimized/34281ffe583b0e798566803bd3dc2880e24aa684-1434x1080.webp`,
  guestOfHonor: `${BG}/optimized/3e7d836b986229fb78a2d97b7299d31e4da9da4c-1434x1080.webp`,
  metaAugments: `${BG}/optimized/5568f896b459de6eca8e27e0b3bebe091d0f5efd-1751x985.webp`,
  prismaticItemPicks: `${BG}/optimized/5b9205dec242b81fdbed2b0791505f827aa4d4ac-1600x841.webp`,
  prismaticItemHallOfFame: `${BG}/optimized/a60edb5b652985524a66408a643a2ba1658c4fb3-796x365.webp`,
  // Anvils, Special Items and Vault currently borrow images used elsewhere —
  // swap in dedicated art when there is some.
  anvils: `${BG}/optimized/6d0a6fc982cfafe1fad81716a4a20201e97cb168-2424x1275.webp`,
  specialItems: `${BG}/optimized/5b9205dec242b81fdbed2b0791505f827aa4d4ac-1600x841.webp`,
  vault: `${BG}/optimized/0bf381944928996d94386d6a85bc0d7668ef9157-1920x1080.webp`,
  boots: `${BG}/optimized/73bcf0e20eb169a183d6ebde29b9c1f364dccaad-700x368.webp`,
  ability: `${BG}/optimized/Jhin_36.webp`,
  summonerSpells: `${BG}/optimized/27fd1033cf923429f0811e355402aecfb00d00cb-1751x1096.webp`,
  utility: `${BG}/optimized/Lux_38.webp`,
  teamSynergy: `${BG}/optimized/ed67f0a05dfea47cef87602395b29eab126fc787-748x328.webp`,
  teammates: `${BG}/optimized/Naafiri_1.webp`,
  nemesis: `${BG}/optimized/Viego_30.webp`,
  pings: `${BG}/optimized/Shaco_44.webp`,
  farewell: `${BG}/optimized/how-to-rank-fast-arena-lol-12237a09a0c7.webp`,
} as const;
