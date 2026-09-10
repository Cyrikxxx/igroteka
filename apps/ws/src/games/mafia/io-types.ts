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
  /** Игрок меняет собственный ник. Только в лобби. */
  "mafia:set_name": (payload: { displayName: string }, ack?: Ack<OkErr>) => void;
  /**
   * Забрать комнату себе, когда хост давно не в сети. Автоматической передачи
   * по обрыву связи нет: комната переходит только по этой кнопке.
   */
  "mafia:claim_host": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:kick": (payload: { userId: string }, ack?: Ack<OkErr>) => void;
  /** Хост снимает бан: выгнанный снова может войти по коду. */
  "mafia:unban": (payload: { userId: string }, ack?: Ack<OkErr>) => void;
  /** Хост отдаёт комнату другому участнику. */
  "mafia:transfer_host": (payload: { userId: string }, ack?: Ack<OkErr>) => void;
  /**
   * Хост начинает ночь, не дожидаясь всех «готов». Нужно, когда кто-то закрыл
   * вкладку на раздаче ролей: иначе партия ждёт его возвращения вечно.
   */
  "mafia:start_night": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  /** Хост обрывает партию и возвращает всех в лобби, не закрывая комнату. */
  "mafia:end_game": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:leave": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:start": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:ready": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  // Игровой цикл (фазы 3–4)
  "mafia:night_action": (
    payload: { action: MafiaNightAction; targetId: string | null },
    ack?: Ack<OkErr>,
  ) => void;
  "mafia:vote": (payload: { targetId: string | null }, ack?: Ack<OkErr>) => void;
  /**
   * «Пропустить обсуждение» — переключатель, доступный каждому живому.
   * Сошлись все — фаза кончается досрочно. Раньше это была кнопка хоста,
   * и погибший или пропавший хост подвешивал стол до таймера.
   */
  "mafia:skip_discussion": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:last_word_done": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:pause": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  "mafia:resume": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  /** Сыграть ещё раз тем же составом: комната возвращается в лобби. */
  "mafia:restart": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
  /** Хост закрывает комнату для всех. */
  "mafia:close": (payload: Record<string, never>, ack?: Ack<OkErr>) => void;
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
