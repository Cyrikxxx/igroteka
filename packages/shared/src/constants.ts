// Источник истины — PROMPT.md §2.6.7. Одни и те же числа должны
// использоваться и в Next.js (apps/web), и в Socket.io сервере (apps/ws).

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 6;
export const MIN_PLAYERS_PER_TEAM = 2;
export const MAX_PLAYERS_PER_TEAM = 6;

export const ROUND_TIME_OPTIONS = [30, 45, 60, 90, 120] as const;
export const WIN_SCORE_OPTIONS = [25, 50, 75, 100] as const;

export const ROUND_TIME_DEFAULT = 60;
export const WIN_SCORE_DEFAULT = 50;
export const PENALTY_SKIP_DEFAULT = false;

export const WORDS_BATCH_SIZE = 50;
export const TIMER_WARNING_SECONDS = 5;

export const MAX_ROOM_PLAYERS = MAX_TEAMS * MAX_PLAYERS_PER_TEAM;
export const ROOM_TTL_SECONDS = 60 * 60 * 24;
export const EXPLAINER_DROP_TIMEOUT_MS = 30_000;

// Соответствует --team-1..--team-6 в globals.css.
export const TEAM_COLOR_VARS = [
  "--team-1",
  "--team-2",
  "--team-3",
  "--team-4",
  "--team-5",
  "--team-6",
] as const;

export function teamColorVar(orderIndex: number): string {
  return TEAM_COLOR_VARS[orderIndex % TEAM_COLOR_VARS.length];
}

// Дефолтные имена команд при создании setup'а.
export const DEFAULT_TEAM_NAMES = [
  "Лисы",
  "Совы",
  "Тигры",
  "Волки",
  "Барсы",
  "Орлы",
];
