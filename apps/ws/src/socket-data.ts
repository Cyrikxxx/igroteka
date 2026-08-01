// Данные, которые auth-middleware кладёт в socket.data. Общие для обеих игр:
// неймспейсы /room и /mafia различаются событиями, но опознаётся участник
// одинаково — по подписанному токену.

import type { WsRole, WsGame } from "@alias/shared/token";

export interface SocketData {
  userId: string;
  roomCode: string;
  role: WsRole;
  game: WsGame;
}
