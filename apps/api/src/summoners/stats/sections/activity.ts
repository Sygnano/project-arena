import type { CalendarDayStats, ChampionGames } from "@arena/types";
import { flooredKda, increment, maxOf, sumOf } from "../aggregate.js";
import type { OwnGame } from "../loadStatsData.js";

/** Champions listed per day and per hour in the hover cards. */
const TOP_CHAMPIONS_COUNT = 3;
const DAY_MS = 86_400_000;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Games bucketed by UTC day or hour. UTC is a deliberate simplification
 * (see `CalendarDayStats`), not the player's own timezone. */
type Bucket = OwnGame[];

function bucketKda(bucket: Bucket) {
  return flooredKda(
    sumOf(bucket, (game) => game.kills),
    sumOf(bucket, (game) => game.deaths),
    sumOf(bucket, (game) => game.assists),
  );
}

function bucketTopChampions(bucket: Bucket): ChampionGames[] {
  const counts = new Map<string, number>();
  for (const game of bucket) increment(counts, game.championName);
  return [...counts]
    .map(([championName, games]) => ({ championName, games }))
    .sort((a, b) => b.games - a.games || a.championName.localeCompare(b.championName))
    .slice(0, TOP_CHAMPIONS_COUNT);
}

const utcDate = (game: OwnGame) => game.gameCreation.toISOString().slice(0, 10);

function calendarDay(date: string, bucket: Bucket): CalendarDayStats {
  const placements = bucket.map((game) => game.placement);
  const top3Finishes = placements.filter((placement) => placement <= 3).length;
  return {
    date,
    gamesPlayed: bucket.length,
    top3Rate: (top3Finishes / bucket.length) * 100,
    avgPlacement: sumOf(bucket, (game) => game.placement) / bucket.length,
    bestPlacement: Math.min(...placements),
    timePlayedSeconds: sumOf(bucket, (game) => game.timePlayedSeconds),
    top1Finishes: placements.filter((placement) => placement === 1).length,
    top3Finishes,
    kda: bucketKda(bucket),
    placements,
    champions: bucketTopChampions(bucket),
  };
}

/** Longest run of consecutive UTC days with a game. `dates` is sorted. */
function longestDayStreak(dates: readonly string[]) {
  let longest = 0;
  let current = 0;
  let previous: number | null = null;
  for (const date of dates) {
    const day = Date.parse(`${date}T00:00:00Z`);
    current = previous !== null && day - previous === DAY_MS ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

/** The UTC weekday with the most games, or null with none. */
function favoriteWeekday(days: readonly CalendarDayStats[]) {
  const gamesByWeekday = new Array<number>(7).fill(0);
  for (const day of days) gamesByWeekday[new Date(`${day.date}T00:00:00Z`).getUTCDay()] += day.gamesPlayed;
  let favorite: string | null = null;
  let most = 0;
  for (let weekday = 0; weekday < 7; weekday++) {
    if (gamesByWeekday[weekday]! > most) {
      most = gamesByWeekday[weekday]!;
      favorite = WEEKDAY_NAMES[weekday]!;
    }
  }
  return favorite;
}

/** Time played, the activity calendar (per UTC day) and the by-hour view. */
export function buildActivityStats(games: readonly OwnGame[]) {
  const dayBuckets = new Map<string, Bucket>();
  const hourBuckets: Bucket[] = Array.from({ length: 24 }, () => []);
  for (const game of games) {
    const date = utcDate(game);
    const day = dayBuckets.get(date);
    if (day) day.push(game);
    else dayBuckets.set(date, [game]);
    hourBuckets[game.gameCreation.getUTCHours()]!.push(game);
  }

  // Games are oldest first, so the days are too.
  const days = [...dayBuckets].map(([date, bucket]) => calendarDay(date, bucket));
  const timePlayedSeconds = sumOf(games, (game) => game.timePlayedSeconds);

  return {
    timePlayed: {
      timePlayedSeconds,
      averageGameSeconds: games.length > 0 ? timePlayedSeconds / games.length : 0,
      longestGameSeconds: maxOf(games, (game) => game.timePlayedSeconds),
      longestStreakDays: longestDayStreak(days.map((day) => day.date)),
      mostGamesInADay: Math.max(0, ...days.map((day) => day.gamesPlayed)),
      favoriteDayOfWeek: favoriteWeekday(days),
    },
    calendar: {
      days,
      gamesByHour: hourBuckets.map((bucket) => bucket.length),
      top1ByHour: hourBuckets.map((bucket) => bucket.filter((game) => game.placement === 1).length),
      top3ByHour: hourBuckets.map((bucket) => bucket.filter((game) => game.placement <= 3).length),
      avgPlacementByHour: hourBuckets.map((bucket) =>
        bucket.length > 0 ? sumOf(bucket, (game) => game.placement) / bucket.length : null,
      ),
      kdaByHour: hourBuckets.map((bucket) => (bucket.length > 0 ? bucketKda(bucket) : null)),
      avgGameSecondsByHour: hourBuckets.map((bucket) => {
        const timed = bucket.filter((game) => game.timePlayedSeconds != null);
        return timed.length > 0 ? sumOf(timed, (game) => game.timePlayedSeconds) / timed.length : null;
      }),
      championsByHour: hourBuckets.map(bucketTopChampions),
    },
  };
}
