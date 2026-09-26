// Правила и лимиты Алиаса. Одни и те же числа должны использоваться
// и в Next.js (apps/web), и в Socket.io сервере (apps/ws).

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 6;
export const MIN_PLAYERS_PER_TEAM = 2;
export const MAX_PLAYERS_PER_TEAM = 6;

// Игра втроём: три «команды» по одному человеку. Пара меняется каждый ход,
// правила круга — в trio.ts.
export const TRIO_TEAMS = 3;
export const TRIO_PLAYERS_PER_TEAM = 1;

export const ROUND_TIME_OPTIONS = [30, 45, 60, 90, 120] as const;
export const WIN_SCORE_OPTIONS = [25, 50, 75, 100] as const;

export const ROUND_TIME_DEFAULT = 60;
export const WIN_SCORE_DEFAULT = 50;
export const PENALTY_SKIP_DEFAULT = false;

/**
 * Границы, внутри которых можно задать своё значение помимо пресетов.
 *
 * Те же числа, по которым сервер клампит присланное: разойдись форма с
 * проверкой — введённое число молча заменялось бы на другое, и человек не
 * понял бы, почему в партии не то, что он выбрал.
 */
export const ROUND_TIME_LIMITS = { min: 10, max: 300 } as const;
export const WIN_SCORE_LIMITS = { min: 0, max: 1000 } as const;

function clampTo(limits: { min: number; max: number }, fallback: number, n: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(limits.min, Math.min(limits.max, Math.round(n)));
}

/** Длительность раунда в секундах, приведённая к допустимой. */
export function clampRoundTime(n: number): number {
  return clampTo(ROUND_TIME_LIMITS, ROUND_TIME_DEFAULT, n);
}

/** Счёт до победы, приведённый к допустимому. */
export function clampWinScore(n: number): number {
  return clampTo(WIN_SCORE_LIMITS, WIN_SCORE_DEFAULT, n);
}

export const WORDS_BATCH_SIZE = 50;

export const ROOM_TTL_SECONDS = 60 * 60 * 24;

/**
 * Сколько живёт комната, в которой не осталось никого на связи. Раньше и
 * такая держалась сутки: код был занят, а зайти в неё было некуда.
 */
export const EMPTY_ROOM_TTL_SECONDS = 60 * 10;

/**
 * Через сколько после ухода хоста в оффлайн остальные могут забрать комнату
 * себе. Сам по себе обрыв связи хоста не лишает: он мог переключить Wi-Fi и
 * вернуться. Но и ждать его вечно, не имея возможности начать игру, нельзя.
 */
export const HOST_CLAIM_AFTER_MS = 60_000;

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
