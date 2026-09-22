# leagueData — League static data

Champions, items, summoner spells and Arena augments: names, prices, tags and icon URLs. Import
from `index.ts`.

```ts
const items = await getItemCatalog();        // one download, then everything is synchronous
items.get(447106).name;                      // "Dragonheart"
items.isLegendary(id);
items.prismaticItems(); items.arenaBoots();

const augments = await getAugmentCatalog();
augments.draftable(); augments.meta(); augments.get(id);

const { keysById, displayNames } = await getChampionCatalog();
const spells = await getSummonerSpells();    // Map<id, { name, iconUrl }>
```

## Source

Everything comes from **CommunityDragon**, `latest` (the live patch). Data Dragon was dropped:
it has no Arena augments, and on every item, champion and spell we use, CommunityDragon had the
same data (checked 2026-09 on every item id in the database, see CLAUDE.md §2). `latest` means
no version to bump after a patch. Each catalog is downloaded on first use and kept for the
process's lifetime (`memoize.ts`). A failed download isn't cached, so the next request retries.

## Files

| File | Job |
|---|---|
| `index.ts` | Public exports. |
| `communityDragon/urls.ts` | Every CommunityDragon URL, and how icon paths become URLs. |
| `communityDragon/fetch.ts` | The downloads. The only network code here. |
| `communityDragon/types.ts` | The raw payload shapes (fields we read only). |
| `memoize.ts` | Download-once cache. |
| `champions.ts` | Champion id -> Riot key, key -> display name. |
| `summonerSpells.ts` | Spell id -> name and icon. |
| `items/itemIds.ts` | Hand-kept Arena item groups: Prismatics, special items, Shardblade, anvil range, Legendary price. |
| `items/itemCatalog.ts` | `ItemCatalog`: items plus the build/Legendary rules. |
| `augments/augmentGroups.ts` | Hand-kept augment groups: non-draft augments, Guest of Honor lines, crafting choices. |
| `augments/augmentCatalog.ts` | `AugmentCatalog`: augments plus the draft pool and crafting lists. |
| `gameCatalog.ts` | The web app's catalog (`GET /catalog`): champion, item and augment names and icons, which recaps reference by id. |

Data files and rules are split: the `*Ids.ts` / `*Groups.ts` files hold the lists that no source
provides and that need checking after a patch. The catalog files hold the code. Arena's boots and
anvil ids live in `@arena/db`, because `parseMatch` needs them without network access.
