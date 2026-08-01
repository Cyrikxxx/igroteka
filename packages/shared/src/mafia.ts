// Доменная модель игры «Мафия». Источник истины для apps/web и apps/ws.
//
// Серверная стейт-машина (apps/ws) хранит ПОЛНЫЙ снапшот `MafiaSnapshot`
// (с тайными ролями) в Redis. Клиенту он НИКОГДА не уходит целиком —
// сервер вычисляет персональный `MafiaView` для каждого сокета (свою роль
// видишь, чужие — нет). См. apps/ws/src/games/mafia/view.ts.

// ─────────── Роли и команды ───────────

export type MafiaRole =
  | "mafia"
  | "don"
  | "sheriff"
  | "doctor"
  | "maniac"
  | "civilian";

export type MafiaTeam = "mafia" | "city" | "maniac";

/** К какой команде относится роль (для подсчёта победы). */
export function roleTeam(role: MafiaRole): MafiaTeam {
  if (role === "mafia" || role === "don") return "mafia";
  if (role === "maniac") return "maniac";
  return "city";
}

// ─────────── Фазы партии ───────────

export type MafiaPhase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "NIGHT"
  | "MORNING"
  | "DISCUSSION"
  | "VOTE"
  | "VOTE_RESULT"
  | "LAST_WORD"
  | "FINISHED";

export type MafiaWinner = "city" | "mafia" | "maniac";

/** Кто/что вывело игрока из игры. `left` — вышел сам или отвалился навсегда. */
export type MafiaDeathCause = "mafia" | "maniac" | "vote" | "left";

/** Ночные действия, которые шлёт клиент. */
export type MafiaNightAction = "mafia" | "doctor" | "sheriff" | "maniac";

// ─────────── Настройки ───────────

export interface MafiaSettings {
  /** "auto" — состав по числу игроков; число — фиксированное кол-во мафий. */
  mafiaCount: number | "auto";
  roles: {
    don: boolean;
    sheriff: boolean;
    doctor: boolean;
    maniac: boolean;
  };
  /** Таймеры в секундах. */
  timers: {
    night: number;
    discussion: number;
    vote: number;
    lastWord: number;
  };
  rules: {
    firstDayNoVote: boolean;
    revealRoles: boolean;
    openVotes: boolean;
    donHiddenFromSheriff: boolean;
    spectatorsSeeRoles: boolean;
  };
}

export const MIN_MAFIA_PLAYERS = 5;
export const MAX_MAFIA_PLAYERS = 16;

export const DEFAULT_MAFIA_SETTINGS: MafiaSettings = {
  mafiaCount: "auto",
  roles: { don: true, sheriff: true, doctor: true, maniac: false },
  timers: { night: 60, discussion: 120, vote: 45, lastWord: 30 },
  rules: {
    firstDayNoVote: true,
    revealRoles: true,
    openVotes: true,
    donHiddenFromSheriff: false,
    spectatorsSeeRoles: true,
  },
};

/** Счётчики ролей для данного числа игроков и настроек. */
export interface MafiaComposition {
  mafia: number; // рядовые мафии (без дона)
  don: number; // 0 или 1
  sheriff: number;
  doctor: number;
  maniac: number;
  civilian: number;
  total: number;
}

/**
 * Раскладка ролей. Авто-мафия = floor(n/3) (9→3, 7→2, как в дизайне),
 * минимум 1. Дон — одна из мафий, если включён и мафий ≥2. Спец-роли по
 * тогглам. Остаток — мирные (минимум 1 гарантирован клампом).
 */
export function computeComposition(
  n: number,
  settings: MafiaSettings,
): MafiaComposition {
  const players = Math.max(0, Math.floor(n));
  const wantMafia =
    settings.mafiaCount === "auto"
      ? Math.max(1, Math.floor(players / 3))
      : Math.max(1, Math.floor(settings.mafiaCount));

  const specials =
    (settings.roles.sheriff ? 1 : 0) +
    (settings.roles.doctor ? 1 : 0) +
    (settings.roles.maniac ? 1 : 0);

  // Хотя бы один мирный должен остаться: мафий не больше n - specials - 1.
  const mafiaTotal = Math.max(1, Math.min(wantMafia, players - specials - 1));
  const don = settings.roles.don && mafiaTotal >= 2 ? 1 : 0;

  const sheriff = settings.roles.sheriff ? 1 : 0;
  const doctor = settings.roles.doctor ? 1 : 0;
  const maniac = settings.roles.maniac ? 1 : 0;
  const civilian = Math.max(
    0,
    players - mafiaTotal - sheriff - doctor - maniac,
  );

  return {
    mafia: mafiaTotal - don,
    don,
    sheriff,
    doctor,
    maniac,
    civilian,
    total: players,
  };
}

/** Человеко-читаемое превью состава для лобби. */
export function describeComposition(c: MafiaComposition): string {
  const mafiaPart =
    c.don > 0
      ? `${c.mafia + c.don} мафии (с Доном)`
      : `${c.mafia} мафи${c.mafia === 1 ? "я" : "и"}`;
  const parts = [mafiaPart];
  if (c.sheriff) parts.push("Шериф");
  if (c.doctor) parts.push("Доктор");
  if (c.maniac) parts.push("Маньяк");
  parts.push(`${c.civilian} мирных`);
  return parts.join(" · ");
}

// ─────────── Полный снапшот (Redis, серверный) ───────────

export interface MafiaPlayerFull {
  userId: string;
  displayName: string;
  avatarIdx: number;
  order: number;
  online: boolean;
  alive: boolean;
  isHost: boolean;
  /** Нажал «Я запомнил» на экране роли. */
  ready: boolean;
  /** null в LOBBY (до раздачи). */
  role: MafiaRole | null;
  eliminatedBy?: MafiaDeathCause;
  deathDay?: number;
}

export interface MafiaNightState {
  /** voterId -> targetId (голоса мафии за жертву). */
  mafiaVotes: Record<string, string>;
  doctorTarget?: string;
  doctorPrevTarget?: string;
  doctorSelfHealUsed: boolean;
  sheriffTarget?: string;
  /** targetId -> isMafia (накопительно за партию, приватно шерифу). */
  sheriffResults: Record<string, boolean>;
  maniacTarget?: string;
  /** userId ролей, зафиксировавших ход этой ночью. */
  acted: string[];
}

export interface MafiaVoteState {
  round: 1 | 2;
  /** voterId -> targetId | "abstain". */
  votes: Record<string, string>;
  leaders?: string[];
  eliminated?: string;
  tie?: boolean;
}

export interface MafiaDeath {
  userId: string;
  displayName: string;
  role: MafiaRole;
  day: number;
  by: MafiaDeathCause;
}

/**
 * Смерть в том виде, в каком её можно показать клиенту: роль заполнена,
 * только если она уже раскрыта правилами (или смотрящий видит всё).
 * Полный `MafiaDeath` с ролью наружу уходить не должен.
 */
export interface MafiaDeathView {
  userId: string;
  displayName: string;
  role?: MafiaRole;
  day: number;
  by: MafiaDeathCause;
}

export interface MafiaSnapshot {
  code: string;
  title: string | null;
  hostId: string;
  createdAt: number;
  phase: MafiaPhase;
  /** Игровой день/ночь (1, 2, …). */
  day: number;
  settings: MafiaSettings;
  players: MafiaPlayerFull[];
  spectators: MafiaPlayerFull[];
  night: MafiaNightState;
  vote: MafiaVoteState;
  timerEndsAt?: number;
  timerPaused?: boolean;
  winner?: MafiaWinner;
  deaths: MafiaDeath[];
  /** userId, ожидающий «последнего слова» перед изгнанием. */
  pendingElim?: string;
}

export function emptyNightState(): MafiaNightState {
  return {
    mafiaVotes: {},
    doctorSelfHealUsed: false,
    sheriffResults: {},
    acted: [],
  };
}

export function emptyVoteState(): MafiaVoteState {
  return { round: 1, votes: {} };
}

// ─────────── Персональный вид (то, что уходит клиенту) ───────────

export interface MafiaPlayerView {
  userId: string;
  displayName: string;
  avatarIdx: number;
  order: number;
  online: boolean;
  alive: boolean;
  isHost: boolean;
  ready: boolean;
  /** Заполнена только если раскрыта (мёртв+revealRoles) или это ты сам. */
  role?: MafiaRole;
  eliminatedBy?: MafiaDeathCause;
  deathDay?: number;
}

export interface MafiaYouView {
  userId: string;
  role: MafiaRole | null;
  team: MafiaTeam | null;
  alive: boolean;
  isHost: boolean;
  ready: boolean;
  isSpectator: boolean;
  /** Имена напарников (для мафии/дона). */
  partners?: string[];
  /** userId напарников (для подсветки в ночной сетке). */
  partnerIds?: string[];
  /** Твой выбор цели этой ночью. */
  nightTarget?: string;
  /** Видно мафии: голоса напарников voterId->targetId. */
  mafiaVotes?: Record<string, string>;
  doctorPrevTarget?: string;
  doctorSelfHealUsed?: boolean;
  /** Накопленные результаты проверок (шериф). */
  sheriffResults?: Record<string, boolean>;
  /** Твой дневной голос. */
  voted?: string;
}

export interface MafiaVoteView {
  round: 1 | 2;
  /** targetId -> кол-во голосов. Заполнено, если openVotes или ты зритель/мёртв. */
  tally?: Record<string, number>;
  totalVoters: number;
  votedCount: number;
  leaders?: string[];
  eliminated?: string;
  tie?: boolean;
}

export interface MafiaView {
  code: string;
  title: string | null;
  hostId: string;
  phase: MafiaPhase;
  day: number;
  settings: MafiaSettings;
  players: MafiaPlayerView[];
  spectatorCount: number;
  readyCount: number;
  aliveCount: number;
  you: MafiaYouView;
  vote?: MafiaVoteView;
  winner?: MafiaWinner;
  deaths: MafiaDeathView[];
  timer?: { msLeft: number; paused: boolean };
  /** Имя/роль того, кого убрали прошлой ночью/голосованием (для MORNING/VOTE_RESULT/LAST_WORD). */
  spotlight?: { displayName: string; role?: MafiaRole; cause?: MafiaDeathCause };
}

// ─────────── Приватные/широковещательные события ───────────

export interface MafiaTickPayload {
  msLeft: number;
  paused: boolean;
}

// ─────────── REST-ответы ───────────

export interface MafiaCreateRoomResponse {
  room: { code: string; title: string | null; hostId: string; settings: MafiaSettings };
  user: { id: string; displayName: string };
  wsUrl: string;
  wsToken: string;
}

export interface MafiaJoinRoomResponse {
  room: { code: string; title: string | null; settings: MafiaSettings };
  user: { id: string; displayName: string };
  wsUrl: string;
  wsToken: string;
}
