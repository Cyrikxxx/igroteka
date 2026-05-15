// Типы Socket.io для WS-сервера. Полный набор событий см. PROMPT.md §2.4.

import type {
  RoomSnapshot,
  RoundPhasePayload,
  RoundCountdownPayload,
  RoundTickPayload,
  RoundWordPayload,
  RoundWordCountPayload,
  RoundReviewPayload,
  RoundCommittedPayload,
} from "@alias/shared/domain";
import type { WsRole } from "@alias/shared/token";

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
  "room:leave": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;

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
  "round:countdown": (payload: RoundCountdownPayload) => void;
  "round:tick": (payload: RoundTickPayload) => void;
  "round:word": (payload: RoundWordPayload) => void;
  "round:word_count": (payload: RoundWordCountPayload) => void;
  "round:review": (payload: RoundReviewPayload) => void;
  "round:committed": (payload: RoundCommittedPayload) => void;
}

export interface InterServerEvents {
  [key: string]: unknown;
}

export interface SocketData {
  userId: string;
  roomCode: string;
  role: WsRole;
}
