// Типы Socket.io для неймспейса /mafia. Отдельный набор событий от Алиаса.
// Клиент получает ПЕРСОНАЛЬНЫЙ MafiaView (свою роль видишь, чужие — нет).

import type { Namespace, Socket } from "socket.io";
import type { MafiaView, MafiaTickPayload, MafiaNightAction } from "@alias/shared/mafia";
import type { SocketData } from "../../socket-data";

type Ack<T> = (resp: T) => void;
type OkErr = { ok: true } | { error: string };

export interface MafiaClientToServerEvents {
  "mafia:hello": (payload: unknown, ack?: Ack<MafiaView | { error: string }>) => void;
  "mafia:settings": (payload: unknown, ack?: Ack<OkErr>) => void;
  "mafia:rename": (payload: { title: string }, ack?: Ack<OkErr>) => void;
  "mafia:kick": (payload: { userId: string }, ack?: Ack<OkErr>) => void;
  /** Хост отдаёт комнату другому участнику. */
  "mafia:transfer_host": (payload: { userId: string }, ack?: Ack<OkErr>) => void;
  "mafia:leave": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:start": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:ready": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  // Игровой цикл (фазы 3–4)
  "mafia:night_action": (
    payload: { action: MafiaNightAction; targetId: string | null },
    ack?: Ack<OkErr>,
  ) => void;
  "mafia:vote": (payload: { targetId: string | null }, ack?: Ack<OkErr>) => void;
  "mafia:end_discussion": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:last_word_done": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:pause": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:resume": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  /** Сыграть ещё раз тем же составом: комната возвращается в лобби. */
  "mafia:restart": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  /** Хост закрывает комнату для всех. */
  "mafia:close": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  /** Хост выводит из партии того, кто отвалился и не возвращается. */
  "mafia:remove_player": (payload: { userId: string }, ack?: Ack<OkErr>) => void;
}

export interface MafiaServerToClientEvents {
  "mafia:state": (view: MafiaView) => void;
  "mafia:tick": (payload: MafiaTickPayload) => void;
  "mafia:closed": (payload: { reason: string }) => void;
  error: (payload: { code: string; message: string }) => void;
}

export interface MafiaInterServerEvents {
  [key: string]: unknown;
}

export type MafiaSocket = Socket<
  MafiaClientToServerEvents,
  MafiaServerToClientEvents,
  MafiaInterServerEvents,
  SocketData
>;

export type MafiaNamespace = Namespace<
  MafiaClientToServerEvents,
  MafiaServerToClientEvents,
  MafiaInterServerEvents,
  SocketData
>;
