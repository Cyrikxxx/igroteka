// Доменные типы, общие для apps/web и apps/ws. См. PROMPT.md §2.3.

export type GameMode = "LOCAL" | "ONLINE";
export type GameStatus = "IN_PROGRESS" | "FINISHED";

// ─── Онлайн-комнаты ──────────────────────────────────────────────────────

export type RoomStatus = "LOBBY" | "IN_GAME" | "FINISHED";

export type ParticipantRole = "PLAYER" | "SPECTATOR";

/** Фазы игрового цикла онлайн-комнаты. См. PROMPT.md §2.6.1. */
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
 * НЕ входит — оно приватный emit. См. PROMPT.md §2.6.5.
 */
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
  durationMs?: number;
}

export interface RoundCountdownPayload {
  secondsLeft: number;
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
}

export interface CategoryFromAPI {
  id: number;
  name: string;
  slug: string;
  emoji: string | null;
  isPublic: boolean;
  _count?: { words: number };
}

export interface RoundResult {
  round: { id: number; roundNumber: number; scoreEarned: number };
  teamScore: number;
  nextTeamIndex: number;
  nextRoundNumber: number;
  gameFinished: boolean;
  winnerId?: number;
}
