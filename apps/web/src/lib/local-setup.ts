// Состояние локального setup-flow (команды + настройки) хранится в
// sessionStorage, чтобы пользователь мог свободно ходить туда-сюда между
// /local/new и /local/settings без потери данных.

import { TeamSetup, GameSettings, GameFormat, PlayerSetup } from "@/types";
import {
  ROUND_TIME_DEFAULT,
  WIN_SCORE_DEFAULT,
  PENALTY_SKIP_DEFAULT,
  DEFAULT_TEAM_NAMES,
  TRIO_TEAMS,
} from "@/constants/game";

const KEY = "alias.local-setup";

export interface LocalSetupState {
  format: GameFormat;
  teams: TeamSetup[];
  /**
   * Состав режима «втроём» — ровно три имени. Лежит рядом с teams, а не
   * вместо них: человек переключает формат туда-обратно, и уже набранные
   * имена от этого пропадать не должны.
   */
  trio: PlayerSetup[];
  settings: GameSettings;
}

export const EMPTY_TRIO: PlayerSetup[] = Array.from({ length: TRIO_TEAMS }, () => ({
  name: "",
}));

export const DEFAULT_LOCAL_SETUP: LocalSetupState = {
  format: "TEAMS",
  teams: [
    { name: DEFAULT_TEAM_NAMES[0], players: [{ name: "" }, { name: "" }] },
    { name: DEFAULT_TEAM_NAMES[1], players: [{ name: "" }, { name: "" }] },
  ],
  trio: EMPTY_TRIO,
  settings: {
    roundTime: ROUND_TIME_DEFAULT,
    winScore: WIN_SCORE_DEFAULT,
    penaltySkip: PENALTY_SKIP_DEFAULT,
    categoryIds: [],
  },
};

/**
 * Состав в том виде, в каком его ждёт POST /api/games. Втроём каждый игрок
 * едет отдельной командой из одного человека: движок считает очки по
 * командам, и «команда из одного» — это ровно личный счёт.
 */
export function teamsForRequest(state: LocalSetupState): TeamSetup[] {
  if (state.format !== "TRIO") return state.teams;
  return state.trio.map((p) => ({ name: p.name.trim(), players: [{ name: p.name.trim() }] }));
}

export function loadLocalSetup(): LocalSetupState {
  if (typeof window === "undefined") return DEFAULT_LOCAL_SETUP;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_LOCAL_SETUP;
    const parsed = JSON.parse(raw) as LocalSetupState;
    // Минимальная санитизация
    if (!parsed.teams || !parsed.settings) return DEFAULT_LOCAL_SETUP;
    // У записей, сделанных до появления режима втроём, этих полей нет.
    return {
      ...parsed,
      format: parsed.format === "TRIO" ? "TRIO" : "TEAMS",
      trio:
        Array.isArray(parsed.trio) && parsed.trio.length === TRIO_TEAMS
          ? parsed.trio
          : EMPTY_TRIO,
    };
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
