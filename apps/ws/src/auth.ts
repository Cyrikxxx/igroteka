// Аутентификация Socket.io: middleware проверяет HMAC-токен,
// выданный REST-эндпоинтом (apps/web). См. PROMPT.md §2.4.1, §2.6.4.

import { verifyWsToken } from "@alias/shared/token";
import type { AppSocket } from "./io-types";

const secret = process.env.WS_TOKEN_SECRET;
if (!secret) {
  throw new Error("WS_TOKEN_SECRET is required (см. .env в корне монорепо)");
}

export function authMiddleware(
  socket: AppSocket,
  next: (err?: Error) => void,
): void {
  const auth = socket.handshake.auth as { token?: unknown; code?: unknown };
  const token = typeof auth?.token === "string" ? auth.token : null;
  const code = typeof auth?.code === "string" ? auth.code : null;

  if (!token || !code) {
    return next(new Error("missing token or room code"));
  }

  const payload = verifyWsToken(token, secret!);
  if (!payload) {
    return next(new Error("invalid token"));
  }
  if (payload.roomCode !== code) {
    return next(new Error("token/room code mismatch"));
  }

  socket.data.userId = payload.userId;
  socket.data.roomCode = payload.roomCode;
  socket.data.role = payload.role;
  next();
}
