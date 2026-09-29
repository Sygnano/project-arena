import type { ChampionFormStats } from "@arena/types";
import { TOP3_RATE_COLOR } from "@/features/recap/components/slides/champion-gallery/components/champion-dossier/constants";

function streakCaption(form: ChampionFormStats): { text: string; color: string } {
  if (form.currentWinStreak >= 2) {
    return { text: `${form.currentWinStreak} WINS IN A ROW`, color: TOP3_RATE_COLOR };
  }
  if (form.currentWinStreak === 1) {
    return { text: "WON LAST GAME", color: TOP3_RATE_COLOR };
  }
  const lastWin = form.games.findIndex((game) => game.placement <= 3);
  if (lastWin === -1) {
    return {
      text: `NO WIN IN ${form.games.length} GAME${form.games.length === 1 ? "" : "S"}`,
      color: "var(--color-lol-text-muted)",
    };
  }
  return {
    text: `LAST WIN ${lastWin} GAME${lastWin === 1 ? "" : "S"} AGO`,
    color: "var(--color-lol-text-secondary)",
  };
}

export { streakCaption };
