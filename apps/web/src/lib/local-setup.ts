// Состояние локального setup-flow (команды + настройки) хранится в
// sessionStorage, чтобы пользователь мог свободно ходить туда-сюда между
// /local/new и /local/settings без потери данных.

import { TeamSetup, GameSettings } from "@/types";
import {
  ROUND_TIME_DEFAULT,
  WIN_SCORE_DEFAULT,
  PENALTY_SKIP_DEFAULT,
  DEFAULT_TEAM_NAMES,
} from "@/constants/game";

const KEY = "alias.local-setup";

export interface LocalSetupState {
  teams: TeamSetup[];
  settings: GameSettings;
}

export const DEFAULT_LOCAL_SETUP: LocalSetupState = {
  teams: [
    { name: DEFAULT_TEAM_NAMES[0], players: [{ name: "" }, { name: "" }] },
    { name: DEFAULT_TEAM_NAMES[1], players: [{ name: "" }, { name: "" }] },
  ],
  settings: {
    roundTime: ROUND_TIME_DEFAULT,
    winScore: WIN_SCORE_DEFAULT,
    penaltySkip: PENALTY_SKIP_DEFAULT,
    categoryIds: [],
  },
};

export function loadLocalSetup(): LocalSetupState {
  if (typeof window === "undefined") return DEFAULT_LOCAL_SETUP;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_LOCAL_SETUP;
    const parsed = JSON.parse(raw) as LocalSetupState;
    // Минимальная санитизация
    if (!parsed.teams || !parsed.settings) return DEFAULT_LOCAL_SETUP;
    return parsed;
  } catch {
    return DEFAULT_LOCAL_SETUP;
  }
}

export function saveLocalSetup(state: LocalSetupState): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(state));
}

export function clearLocalSetup(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
