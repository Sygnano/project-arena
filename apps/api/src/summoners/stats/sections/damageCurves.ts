import type {
  ChampionDamageCurve,
  DamageCurve,
  DamageCurveBestGame,
  DamageCurveSeries,
  DamageCurveStats,
} from "@arena/types";
import type { OwnGame } from "../loadStatsData.js";

/** Cumulative damage to champions at one minute of a match. */
interface DamageCurvePoint {
  minute: number;
  physical: number;
  magical: number;
  trueDamage: number;
}

function toSeries(points: readonly DamageCurvePoint[]): DamageCurveSeries {
  return {
    physical: points.map((point) => point.physical),
    magical: points.map((point) => point.magical),
    trueDamage: points.map((point) => point.trueDamage),
  };
}

/** `[t (ms), physical, magical, true]` per timeline frame, cumulative damage
 * to champions: `match_participants.frames` as stored. */
type Frames = NonNullable<OwnGame["frames"]>;

const MS_PER_MINUTE = 60_000;

function finalDamage(points: readonly DamageCurvePoint[]): number {
  const last = points[points.length - 1];
  return last ? last.physical + last.magical + last.trueDamage : 0;
}

/**
 * One game's cumulative curve, one point per whole minute. Timeline frames
 * land ~every 60s plus a final one at the match's end (e.g. 29:26), so each
 * frame is rounded to its nearest minute and a later frame wins a shared
 * minute (the values are cumulative, so the later one is the truer total).
 */
function gameCurve(frames: Frames): DamageCurvePoint[] {
  const points: DamageCurvePoint[] = [];
  for (const [t, physical, magical, trueDamage] of frames) {
    const minute = Math.round(t / MS_PER_MINUTE);
    const point = {
      minute,
      physical: physical ?? 0,
      magical: magical ?? 0,
      trueDamage: trueDamage ?? 0,
    };
    // Fill any skipped minute with the previous value (nothing was dealt).
    while (points.length < minute) {
      const previous = points[points.length - 1];
      points.push(
        previous
          ? { ...previous, minute: points.length }
          : { minute: points.length, physical: 0, magical: 0, trueDamage: 0 },
      );
    }
    points[minute] = point;
  }
  return points;
}

function sumCurves(curves: readonly DamageCurvePoint[][]): DamageCurvePoint[] {
  const length = Math.max(0, ...curves.map((curve) => curve.length));
  const total: DamageCurvePoint[] = Array.from({ length }, (_, minute) => ({
    minute,
    physical: 0,
    magical: 0,
    trueDamage: 0,
  }));
  for (const curve of curves) {
    for (let minute = 0; minute < length; minute++) {
      // A game that has ended keeps its final total (see `DamageCurve`).
      const point = curve[Math.min(minute, curve.length - 1)];
      if (!point) continue;
      total[minute].physical += point.physical;
      total[minute].magical += point.magical;
      total[minute].trueDamage += point.trueDamage;
    }
  }
  return total;
}

type Game = { row: OwnGame; points: DamageCurvePoint[] };

function buildCurve(games: readonly Game[]): DamageCurve {
  let best = games[0]!;
  for (const game of games) {
    if (finalDamage(game.points) > finalDamage(best.points)) best = game;
  }
  const bestGame: DamageCurveBestGame = {
    championName: best.row.championName,
    placement: best.row.placement,
    timePlayedSeconds: best.row.timePlayedSeconds ?? 0,
    series: toSeries(best.points),
  };
  return {
    games: games.length,
    total: toSeries(sumCurves(games.map((game) => game.points))),
    bestGame,
  };
}

/** Damage over the course of a game, from the games with a stored timeline. */
export function buildDamageCurveStats(rows: readonly OwnGame[]): DamageCurveStats {
  const games: Game[] = rows
    .flatMap((row) => (row.frames ? [{ row, points: gameCurve(row.frames) }] : []))
    .filter((game) => game.points.length > 0);
  if (games.length === 0) return { all: null, champions: [] };

  const byChampion = new Map<number, Game[]>();
  for (const game of games) {
    const list = byChampion.get(game.row.championId) ?? [];
    list.push(game);
    byChampion.set(game.row.championId, list);
  }

  const champions: ChampionDamageCurve[] = [...byChampion.entries()]
    .map(([championId, championGames]) => ({
      championId,
      championName: championGames[0]!.row.championName,
      ...buildCurve(championGames),
    }))
    .sort((a, b) => b.games - a.games || a.championId - b.championId);

  return { all: buildCurve(games), champions };
}
