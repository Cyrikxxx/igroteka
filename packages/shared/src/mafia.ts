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

// ─────────── Шаги ночи (режим ведущего) ───────────

/**
 * Шаг ночи. "sleep" — общая команда закрыть глаза, дальше роли по очереди.
 * План строится из НАСТРОЕК, а не из живых: мёртвую роль ведущий зовёт так
 * же, как живую, иначе её смерть была бы слышна первой же ночью.
 */
export type MafiaNightStepRole = "sleep" | "mafia" | "doctor" | "sheriff" | "maniac";

/**
 * Стадия шага: announce — говорит ведущий, ход ещё закрыт; act — окно хода;
 * gap — тишина после хода, за которую сходивший закрывает глаза.
 */
export type MafiaNightStage = "announce" | "act" | "gap";

export interface MafiaNightStep {
  role: MafiaNightStepRole;
  stage: MafiaNightStage;
  /** Позиция в плане ночи. */
  index: number;
  /**
   * Длина окна хода, мс. У мёртвой роли — случайная: шаг, проскочивший
   * мгновенно, выдал бы, что роли больше нет. Решается один раз при входе в
   * шаг и хранится здесь, чтобы перезапуск ws не переигрывал случайность.
   */
  actMs: number;
}

/** «Город засыпает, все закрывают глаза» — перед первым шагом. */
export const NIGHT_SLEEP_MS = 6000;
/** Ведущий называет роль; ход в это время ещё запрещён. */
export const NIGHT_ANNOUNCE_MS = 4500;
/** Тишина после хода: сходивший успевает закрыть глаза. */
export const NIGHT_GAP_MS = 3000;
/** Шерифу дольше — он ещё читает вердикт проверки. */
export const NIGHT_SHERIFF_GAP_MS = 5000;
/** Нижняя граница «раздумья» мёртвой роли. */
export const NIGHT_IDLE_MIN_MS = 5000;

// ─────────── Настройки ───────────

export interface MafiaSettings {
  /** "auto" — состав по числу игроков; число — фиксированное кол-во мафий. */
  mafiaCount: number | "auto";
  /**
   * Игра за одним столом: ночь идёт по шагам, роли просыпаются по очереди, и
   * сайт проговаривает вслух, кому просыпаться. Без него ночь как прежде —
   * одна общая фаза, все ходят одновременно каждый на своём телефоне.
   */
  narrator: boolean;
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
    /** Сколько длится ход одной роли в режиме ведущего. */
    nightStep: number;
  };
  rules: {
    firstDayNoVote: boolean;
    revealRoles: boolean;
    openVotes: boolean;
    donHiddenFromSheriff: boolean;
    spectatorsSeeRoles: boolean;
  };
}

/**
 * Допустимые границы таймеров, секунды. Одни и те же и для формы, и для
 * сервера: разойдись они — введённое хостом число тихо заменялось бы на
 * другое, и он бы не понял, почему.
 */
export const MAFIA_TIMER_LIMITS: Record<
  keyof MafiaSettings["timers"],
  { min: number; max: number }
> = {
  night: { min: 15, max: 180 },
  discussion: { min: 30, max: 600 },
  vote: { min: 15, max: 120 },
  lastWord: { min: 10, max: 90 },
  nightStep: { min: 8, max: 60 },
};

export const MIN_MAFIA_PLAYERS = 5;
export const MAX_MAFIA_PLAYERS = 16;

export const DEFAULT_MAFIA_SETTINGS: MafiaSettings = {
  mafiaCount: "auto",
  narrator: false,
  roles: { don: true, sheriff: true, doctor: true, maniac: false },
  timers: { night: 60, discussion: 120, vote: 45, lastWord: 30, nightStep: 20 },
  rules: {
    firstDayNoVote: true,
    revealRoles: true,
    openVotes: true,
    donHiddenFromSheriff: false,
    spectatorsSeeRoles: true,
  },
};

/**
 * Привести присланные настройки к полным и допустимым.
 *
 * Настройки приходят с клиента и лежат в Redis/Postgres как JSON, поэтому у
 * комнат, созданных раньше, новых полей попросту нет: недостающее берётся из
 * `base` (по умолчанию — дефолты), лишнее игнорируется, числа клампятся.
 * Одна функция на оба входа: создание комнаты по REST и mafia:settings в ws.
 */
export function normalizeMafiaSettings(
  input: unknown,
  base: MafiaSettings = DEFAULT_MAFIA_SETTINGS,
): MafiaSettings {
  const out: MafiaSettings = {
    mafiaCount: base.mafiaCount,
    narrator: base.narrator ?? false,
    roles: { ...base.roles },
    timers: { ...DEFAULT_MAFIA_SETTINGS.timers, ...base.timers },
    rules: { ...base.rules },
  };
  if (!input || typeof input !== "object") return out;
  const x = input as Record<string, unknown>;

  if (x.mafiaCount === "auto") out.mafiaCount = "auto";
  else if (typeof x.mafiaCount === "number")
    out.mafiaCount = Math.max(1, Math.min(8, Math.round(x.mafiaCount)));

  if (typeof x.narrator === "boolean") out.narrator = x.narrator;

  if (x.roles && typeof x.roles === "object") {
    const r = x.roles as Record<string, unknown>;
    for (const k of ["don", "sheriff", "doctor", "maniac"] as const)
      if (typeof r[k] === "boolean") out.roles[k] = r[k] as boolean;
  }

  if (x.timers && typeof x.timers === "object") {
    const t = x.timers as Record<string, unknown>;
    for (const key of Object.keys(MAFIA_TIMER_LIMITS) as (keyof MafiaSettings["timers"])[]) {
      const v = t[key];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const { min, max } = MAFIA_TIMER_LIMITS[key];
      out.timers[key] = Math.max(min, Math.min(max, Math.round(v)));
    }
  }

  if (x.rules && typeof x.rules === "object") {
    const ru = x.rules as Record<string, unknown>;
    for (const k of [
      "firstDayNoVote",
      "revealRoles",
      "openVotes",
      "donHiddenFromSheriff",
      "spectatorsSeeRoles",
    ] as const)
      if (typeof ru[k] === "boolean") out.rules[k] = ru[k] as boolean;
  }

  return out;
}

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
  /** Порядок шагов этой ночи. Только в режиме ведущего. */
  plan?: MafiaNightStepRole[];
  /** Где ночь сейчас. Только в режиме ведущего. */
  step?: MafiaNightStep;
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

// ─────────── Журнал партии ───────────

/**
 * Что произошло по ходу партии. Из журнала строятся два экрана: живая
 * лента у зрителя и «хроника партии» в финале.
 *
 * ВАЖНО: записи содержат роли и результаты проверок, поэтому живым
 * игрокам журнал не отдаётся вовсе — см. buildView.
 */
export type MafiaEventKind =
  | "night_fell"
  | "kill"
  | "save"
  | "check"
  | "no_deaths"
  | "exile"
  | "vote_tie"
  | "left"
  | "game_over";

export interface MafiaEvent {
  /** Игровой день/ночь, к которым относится запись. */
  day: number;
  kind: MafiaEventKind;
  /** Кого касается запись (жертва, спасённый, проверенный, изгнанный). */
  displayName?: string;
  role?: MafiaRole;
  /** Кто сделал ход — для «доктор спас», «шериф проверил». */
  actor?: MafiaRole;
  /** Результат проверки шерифа. */
  isMafia?: boolean;
  /** Чем закончилась партия. */
  winner?: MafiaWinner;
  cause?: MafiaDeathCause;
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
  /** Сколько оставалось на момент паузы — из этого считается новый дедлайн. */
  timerRemainingMs?: number;
  winner?: MafiaWinner;
  deaths: MafiaDeath[];
  /** Хронология партии: ночи, смерти, спасения, проверки, изгнания. */
  events: MafiaEvent[];
  /** userId, ожидающий «последнего слова» перед изгнанием. */
  pendingElim?: string;
  /**
   * Кого выгнал хост. Без этого списка кик бесполезен: токен у выгнанного
   * остаётся рабочим, и он тут же вернулся бы по mafia:hello.
   */
  banned?: { userId: string; displayName: string }[];
  /**
   * Когда хост пропал из сети (мс). Пока стоит — остальные могут забрать
   * комнату себе, но только через HOST_CLAIM_AFTER_MS: сам по себе обрыв
   * связи хоста прав не лишает. Снимается, когда он возвращается.
   */
  hostOfflineSince?: number | null;
  /**
   * Партия встала потому, что в комнате не осталось никого на связи, — а не
   * потому, что хост нажал паузу. Различать обязательно: такую паузу снимает
   * первый вернувшийся, хостскую — только сам хост.
   */
  pausedByEmpty?: boolean;
  /**
   * Счётчик повторов реплики. Клиент произносит текст, когда меняется ключ, а
   * после паузы роль надо вызвать теми же словами — ключ совпал бы, и все
   * промолчали бы. Снятие паузы поднимает счётчик, и реплика звучит снова.
   */
  narrationEpoch?: number;
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

/** Игрок, на котором сейчас держится экран (утро, итог голосования). */
export interface MafiaSpotlightEntry {
  userId: string;
  displayName: string;
  avatarIdx: number;
  role?: MafiaRole;
  cause?: MafiaDeathCause;
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
  /**
   * Журнал партии. Заполнен ТОЛЬКО для тех, кому и так видно всё
   * (финал, выбывшие и зрители при включённом правиле) — живому игроку
   * он раскрыл бы роли и проверки шерифа.
   */
  events?: MafiaEvent[];
  timer?: { msLeft: number; paused: boolean };
  /**
   * Партия на паузе. Отдельно от `timer`, потому что ночью в режиме ведущего
   * остаток видит только тот, чей ход, — а плашку паузы должны увидеть все.
   */
  paused: boolean;
  /**
   * Кого подсвечивает текущая фаза: всех погибших этой ночью (MORNING) или
   * изгоняемого (VOTE_RESULT/LAST_WORD). Список, а не один игрок: с
   * маньяком за ночь легко гибнут двое, и второго нельзя терять.
   */
  spotlight?: MafiaSpotlightEntry[];
  /**
   * Кого хост выгнал. Отдаём только хосту: остальным знать этот список
   * незачем, а хосту он нужен, чтобы вернуть выгнанного по ошибке.
   */
  banned?: { userId: string; displayName: string }[];
  /** Когда хост пропал из сети — по нему рисуется «взять комнату на себя». */
  hostOfflineSince?: number | null;
  /**
   * Где идёт ночь в режиме ведущего. Сам шаг виден всем — его всё равно
   * произносят вслух; `yourTurn` считает сервер, по нему клиент решает,
   * гасить экран или показывать сетку.
   */
  night?: {
    step: MafiaNightStepRole;
    stage: MafiaNightStage;
    yourTurn: boolean;
  };
  /**
   * Что должен произнести ведущий. Текст сочиняет СЕРВЕР и одинаковый для
   * всех: собери его клиент из персонального вида — устройство мёртвого
   * хоста, которому видны все роли, зачитало бы их вслух на весь стол.
   */
  narration?: { key: string; text: string };
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
