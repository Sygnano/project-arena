import type { Platform } from "@arena/riot";

/**
 * Where the crawler starts on a platform it has no summoner on yet: the top
 * of arenasweats.lol's live Arena leaderboard for that region, taken
 * 2026-09-23 from `https://arenasweats.lol/api/leaderboard?start_rank=1&end_rank=3&region=<EUW|NA|...>&season=live`.
 * That site calls SG2 `SEA` (`SG` silently returns NA's list). Its ME list
 * also ranks EUW players (Match-V5 serves ME1 and EUW1 from one cluster), so
 * the me1 seeds were checked to play their Arena games on ME1.
 *
 * Each list is tried in order until Riot knows one of the Riot IDs (players
 * rename), and only one is needed: the crawl snowballs from there. If every
 * name on a list is gone, the crawler logs it and skips the platform; refill
 * it from that URL.
 *
 * Covers the platforms the web app's search offers (`SEARCH_PLATFORMS` in
 * apps/web/src/lib/riot.ts). Crawling a platform nobody can search would
 * only spend its cluster's Riot budget.
 */
export const CRAWL_SEEDS: Partial<Record<Platform, ReadonlyArray<{ gameName: string; tagLine: string }>>> = {
  euw1: [
    { gameName: "A Drunk Penguin", tagLine: "Noot" },
    { gameName: "Meeeeeeeow", tagLine: "EUW" },
    { gameName: "heroinbob1v9", tagLine: "cøm" },
  ],
  eun1: [
    { gameName: "Onomamania", tagLine: "ARENA" },
    { gameName: "TheEdenProject", tagLine: "ARENA" },
    { gameName: "Sharow", tagLine: "ARENA" },
  ],
  na1: [
    { gameName: "fed fiora fart", tagLine: "VITAL" },
    { gameName: "hot guy 6 pack69", tagLine: "hot69" },
    { gameName: "transconayute", tagLine: "bigT" },
  ],
  kr: [
    { gameName: "홍성식", tagLine: "KR5" },
    { gameName: "Mochas", tagLine: "0317" },
    { gameName: "Liberty", tagLine: "24708" },
  ],
  jp1: [
    { gameName: "丨StarRanger丨", tagLine: "JP1" },
    { gameName: "塩対応", tagLine: "llll" },
    { gameName: "WIFIの妖精", tagLine: "6407" },
  ],
  br1: [
    { gameName: "Presente", tagLine: "1001" },
    { gameName: "Hollow Gun", tagLine: "br1" },
    { gameName: "Mamei o Barrufi", tagLine: "Banho" },
  ],
  la1: [
    { gameName: "Support Nami", tagLine: "LAN" },
    { gameName: "JuanStan", tagLine: "LAN02" },
    { gameName: "Muradeños", tagLine: "LAN" },
  ],
  la2: [
    { gameName: "Octavio", tagLine: "Dalo" },
    { gameName: "Hydaelyn", tagLine: "Venat" },
    { gameName: "KeshaPecha", tagLine: "LAS" },
  ],
  oc1: [
    { gameName: "will2gxb", tagLine: "OC" },
    { gameName: "ºººººººººººººº", tagLine: "OC" },
    { gameName: "Zelyuras", tagLine: "Nihil" },
  ],
  sg2: [
    { gameName: "Lisan al Gaib", tagLine: "SLNCE" },
    { gameName: "Phobia", tagLine: "8797" },
    { gameName: "Dizzy", tagLine: "Ruler" },
  ],
  tw2: [
    { gameName: "提比ü", tagLine: "3783" },
    { gameName: "ハクネリ", tagLine: "0000" },
    { gameName: "Houdini123", tagLine: "1817" },
  ],
  vn2: [
    { gameName: "41422423411", tagLine: "thanh" },
    { gameName: "i AmSoKool", tagLine: "1912" },
    { gameName: "NGUYEN LIN", tagLine: "9999" },
  ],
  tr1: [
    { gameName: "Authority", tagLine: "00000" },
    { gameName: "olerzeg38", tagLine: "TR1" },
    { gameName: "destroyma", tagLine: "TR1" },
  ],
  ru: [
    { gameName: "МирГлазамиПчелы", tagLine: "мда" },
    { gameName: "Azichka", tagLine: "Shmel" },
    { gameName: "куплинов плей", tagLine: "angel" },
  ],
  me1: [
    { gameName: "AlraisiN", tagLine: "6969" },
    { gameName: "أبو القعقاع", tagLine: "تميمي" },
    { gameName: "EXIL", tagLine: "69420" },
  ],
};
