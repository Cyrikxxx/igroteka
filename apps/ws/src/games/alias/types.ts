// Типы Socket.io для неймспейса /room (Алиас): события клиент↔сервер.

import type {
  GameFormat,
  RoomSnapshot,
  RoundPhasePayload,
  RoundTickPayload,
  RoundWordPayload,
  RoundWordCountPayload,
  RoundReviewPayload,
  RoundCommittedPayload,
} from "@alias/shared/domain";

type Ack<T> = (resp: T) => void;
type OkErr = { ok: true } | { error: string };

export interface ClientToServerEvents {
  // ─── Lobby ──────────────────────────────────────────────────────────
  "room:hello": (
    payload: unknown,
    ack?: Ack<RoomSnapshot | { error: string }>,
  ) => void;
  "team:create": (
    payload: { name?: string; color?: string },
    ack?: Ack<{ ok: true; teamId: number } | { error: string }>,
  ) => void;
  "team:rename": (
    payload: { teamId: number; name: string },
    ack?: Ack<OkErr>,
  ) => void;
  "team:remove": (
    payload: { teamId: number },
    ack?: Ack<OkErr>,
  ) => void;
  "team:join": (
    payload: { teamId: number | null },
    ack?: Ack<OkErr>,
  ) => void;
  "room:rename": (
    payload: { title: string },
    ack?: Ack<OkErr>,
  ) => void;
  /** Игрок меняет собственный ник. Только в лобби. */
  "room:set_name": (
    payload: { displayName: string },
    ack?: Ack<OkErr>,
  ) => void;
  "room:settings": (
    payload: {
      roundTime?: number;
      winScore?: number;
      penaltySkip?: boolean;
      categoryIds?: number[];
    },
    ack?: Ack<OkErr>,
  ) => void;
  /**
   * Формат партии. Втроём вместо команд — три места по одному человеку;
   * состав при переключении уезжает в зрители.
   */
  "room:format": (
    payload: { format: GameFormat },
    ack?: Ack<OkErr>,
  ) => void;
  "room:leave": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  /** Хост выгоняет игрока из лобби. Выгнанный попадает в snapshot.banned. */
  "room:kick": (payload: { userId: string }, ack?: Ack<OkErr>) => void;
  /** Хост снимает бан: выгнанный снова может войти по коду. */
  "room:unban": (payload: { userId: string }, ack?: Ack<OkErr>) => void;
  /** Хост отдаёт комнату другому участнику. */
  "room:transfer_host": (payload: { userId: string }, ack?: Ack<OkErr>) => void;
  /** Сыграть ещё раз тем же составом: комната возвращается в лобби. */
  "room:restart": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  /** Хост закрывает комнату для всех. */
  "room:close": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;

  // ─── Round (game cycle) ────────────────────────────────────────────
  "round:start_game": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "round:guess": (
    payload: { wordId: number; guessed: boolean },
    ack?: Ack<
      { ok: true; nextWord: RoundWordPayload | null } | { error: string }
    >,
  ) => void;
  "round:pause": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "round:resume": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "round:end": (
    payload: { confirm: true },
    ack?: Ack<OkErr>,
  ) => void;
  "round:review_toggle": (
    payload: { wordId: number },
    ack?: Ack<OkErr>,
  ) => void;
  "round:review_confirm": (
    payload: Record<string, never>,
    ack?: Ack<OkErr>,
  ) => void;
}

export interface ServerToClientEvents {
  "room:state": (snapshot: RoomSnapshot) => void;
  "room:player_joined": (payload: {
    user: { id: string; displayName: string };
    role: "PLAYER" | "SPECTATOR";
  }) => void;
  "room:player_left": (payload: { userId: string }) => void;
  "room:player_online": (payload: { userId: string; online: boolean }) => void;
  "room:closed": (payload: { reason: string }) => void;
  error: (payload: { code: string; message: string }) => void;

  "round:phase": (payload: RoundPhasePayload) => void;
  "round:tick": (payload: RoundTickPayload) => void;
  "round:word": (payload: RoundWordPayload) => void;
  "round:word_count": (payload: RoundWordCountPayload) => void;
  "round:review": (payload: RoundReviewPayload) => void;
  "round:committed": (payload: RoundCommittedPayload) => void;
}

export interface InterServerEvents {
  [key: string]: unknown;
}

// SocketData общая для обеих игр — см. src/socket-data.ts.
export type { SocketData } from "../../socket-data";
