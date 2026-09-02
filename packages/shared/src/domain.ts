// Доменные типы Алиаса, общие для apps/web и apps/ws.
// Типы Мафии — в соседнем mafia.ts.

export type GameMode = "LOCAL" | "ONLINE";
export type GameStatus = "IN_PROGRESS" | "FINISHED";

/**
 * Формат партии. TEAMS — как было всегда: команды по два и больше человека.
 * TRIO — трое играют парами по кругу, каждая «команда» из одного человека,
 * очки за раунд идут обоим игрокам пары. Правила круга — в trio.ts.
 */
export type GameFormat = "TEAMS" | "TRIO";

// ─── Онлайн-комнаты ──────────────────────────────────────────────────────

export type RoomStatus = "LOBBY" | "IN_GAME" | "FINISHED";

/** Фазы игрового цикла онлайн-комнаты. */
export type Phase =
  | "LOBBY"
  | "PRE_ROUND"
  | "ROUND_ACTIVE"
  | "ROUND_REVIEW"
  | "BETWEEN_ROUNDS"
  | "FINISHED";

export interface RoomSnapshotPlayer {
  userId: string;
  displayName: string;
  online: boolean;
  order: number;
}

export interface RoomSnapshotTeam {
  id: number;
  name: string;
  color: string;
  score: number;
  players: RoomSnapshotPlayer[];
  /**
   * Индекс игрока в `players`, чей сейчас ход / следующий — когда команда
   * получит управление. Инкрементируется при `ROUND_REVIEW → BETWEEN_ROUNDS`
   * для команды, которая только что отыграла.
   */
  playerCursor?: number;
}

/**
 * Postgres Team.id, проставленный после `LOBBY → PRE_ROUND`. Этот id
 * отличается от RoomSnapshotTeam.id (последний — локальный в лобби) и
 * нужен серверу WS, чтобы записывать Round/RoundWord. Хранится в
 * Redis-снимке для удобства, но НЕ шлётся клиенту в WS-событиях
 * (клиенту по-прежнему видна `RoomSnapshotTeam.id`).
 */
export type TeamIdMap = Record<number, number>;

/**
 * Снимок комнаты — то, что лежит в Redis ключом `room:<code>` и шлётся
 * клиентам событием `room:state`. Слово, видимое explainer'у, в снимок
 * НЕ входит — оно уходит приватным emit'ом только его сокету.
 */
export interface BannedPlayer {
  userId: string;
  displayName: string;
}

export interface RoomSnapshot {
  code: string;
  title: string | null;
  status: RoomStatus;
  hostId: string;
  settings: {
    roundTime: number;
    winScore: number;
    penaltySkip: boolean;
    categoryIds: number[];
  };
  phase: Phase;
  currentTeamId: number | null;
  currentPlayerId: string | null;
  /**
   * Кто угадывает. Заполняется только втроём: в обычном режиме угадывает вся
   * команда объясняющего, и одного человека тут не назвать.
   */
  currentGuesserId?: string | null;
  currentRoundNumber: number;
  teams: RoomSnapshotTeam[];
  spectators: RoomSnapshotPlayer[];
  timer: { msLeft: number; paused: boolean } | null;
  scoreboard: { teamId: number; got: number; skip: number } | null;
  gameId: string | null;
  /** Маппинг локальный snapshot teamId → Postgres Team.id. См. `TeamIdMap`. */
  teamIdMap?: TeamIdMap;
  /** Индекс команды в массиве teams, чей сейчас ход. */
  currentTeamIndex?: number;
  /**
   * Формат партии. Необязательное поле: у комнат, созданных до появления
   * режима втроём, его нет — отсутствие читается как TEAMS.
   */
  format?: GameFormat;
  /** Номер хода в круге, 0..5. Только втроём; см. trio.ts. */
  trioTurn?: number;
  /**
   * Когда хост пропал из сети (мс). Пока стоит — остальные могут забрать
   * комнату себе, но только через HOST_CLAIM_AFTER_MS: сам по себе обрыв
   * связи хоста прав не лишает. Снимается, когда он возвращается.
   */
  hostOfflineSince?: number | null;
  /**
   * Кого хост выгнал из комнаты. Без этого списка выгнанный вернулся бы сам:
   * WS-токен живёт час, а креды лежат в sessionStorage — достаточно нажать
   * F5. Имя храним, чтобы хост видел, кого возвращает по room:unban.
   * Живёт в снапшоте Redis: пересоздание комнаты бан снимает.
   */
  banned?: BannedPlayer[];
}

export interface CreateRoomResponse {
  room: {
    code: string;
    title: string | null;
    hostId: string;
    settings: RoomSnapshot["settings"];
  };
  user: { id: string; displayName: string };
  wsUrl: string;
  wsToken: string;
}

export interface JoinRoomResponse {
  room: {
    code: string;
    title: string | null;
    status: RoomStatus;
    hostId: string;
    settings: RoomSnapshot["settings"];
    playersCount: number;
  };
  user: { id: string; displayName: string };
  wsUrl: string;
  wsToken: string;
}

// ─── Игровой цикл онлайн (события WS) ────────────────────────────────────

export interface RoundPhasePayload {
  phase: Phase;
  roundNumber: number;
  currentTeamId: number | null;
  currentPlayerId: string | null;
  /** Только втроём — см. RoomSnapshot.currentGuesserId. */
  currentGuesserId?: string | null;
  durationMs?: number;
}

export interface RoundTickPayload {
  msLeft: number;
}

export interface RoundWordPayload {
  wordId: number;
  text: string;
  index: number;
  total: number;
}

export interface RoundWordCountPayload {
  got: number;
  skip: number;
  msLeft: number;
}

export interface RoundReviewWord {
  wordId: number;
  text: string;
  guessed: boolean;
  order: number;
}

export interface RoundReviewPayload {
  teamId: number;
  words: RoundReviewWord[];
  scorePreview: number;
}

export interface RoundCommittedPayload {
  teamId: number;
  scoreEarned: number;
  teamScore: number;
  nextTeamId: number | null;
  nextRoundNumber: number;
  gameFinished: boolean;
  winnerTeamId?: number;
  gameId: string;
}

// ─── Setup (создание игры) ────────────────────────────────────────────────

export interface PlayerSetup {
  name: string;
}

export interface TeamSetup {
  name: string;
  players: PlayerSetup[];
}

export interface GameSettings {
  roundTime: number;
  winScore: number;
  penaltySkip: boolean;
  categoryIds: number[];
}

// ─── Клиентское состояние раунда ──────────────────────────────────────────

export interface WordInRound {
  wordId: number;
  text: string;
  /** true=угадано, false=пропущено, null=ещё не показано/не выбрано */
  guessed: boolean | null;
  /** Порядок показа слова в раунде (RoundWord.order при сохранении) */
  order: number;
}

// ─── DTO от REST API ──────────────────────────────────────────────────────

export interface PlayerFromAPI {
  id: number;
  name: string;
  order: number;
  teamId: number;
  userId: string | null;
}

export interface TeamFromAPI {
  id: number;
  name: string;
  color: string;
  score: number;
  order: number;
  currentPlayerIndex: number;
  gameId: string;
  players: PlayerFromAPI[];
}

export interface RoundWordFromAPI {
  id: number;
  guessed: boolean;
  order: number;
  wordId: number;
  word?: { text: string };
}

export interface RoundFromAPI {
  id: number;
  roundNumber: number;
  teamId: number;
  /** Втроём — команда угадывавшего; в обычном режиме null. */
  partnerTeamId: number | null;
  gameId: string;
  playerName: string;
  scoreEarned: number;
  startedAt: string;
  endedAt: string | null;
  words: RoundWordFromAPI[];
}

export interface GameFromAPI {
  id: string;
  mode: GameMode;
  format: GameFormat;
  /** Номер хода в круге, 0..5. Осмыслен только при format === "TRIO". */
  trioTurn: number;
  status: GameStatus;
  ownerKey: string;
  roomId: string | null;
  roundTime: number;
  winScore: number;
  penaltySkip: boolean;
  currentTeamIndex: number;
  currentRoundNumber: number;
  usedWordIds: number[];
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  teams: TeamFromAPI[];
  rounds?: RoundFromAPI[];
  gameCategories: {
    categoryId: number;
    category?: { name: string; emoji: string | null };
  }[];
  /** Для онлайн-игр — связанная комната (код нужен для «Продолжить»). */
  room?: { code: string } | null;
}

export interface CategoryFromAPI {
  id: number;
  name: string;
  slug: string;
  emoji: string | null;
  isPublic: boolean;
  /** THEME — тема внутри подборки, LEVEL — уровень сложности. */
  kind: "THEME" | "LEVEL";
  /** newyear | halloween | summer — в свой месяц тема поднимается наверх. */
  season: string | null;
  isPopular: boolean;
  _count?: { words: number };
}

/** Подборка тем со своим содержимым — то, что рисует экран выбора. */
export interface CollectionFromAPI {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  categories: CategoryFromAPI[];
}

/**
 * Весь каталог одним ответом: уровни сложности отдельно, темы — внутри
 * своих подборок. Экранов выбора три, и каждому нужно одно и то же.
 */
export interface CatalogFromAPI {
  levels: CategoryFromAPI[];
  collections: CollectionFromAPI[];
}
