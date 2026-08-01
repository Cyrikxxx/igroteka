// Аутентификация Socket.io: middleware проверяет HMAC-токен,
// выданный REST-эндпоинтом (apps/web).

import { verifyWsToken } from "@alias/shared/token";
import type { SocketData } from "./socket-data";

// Middleware смотрит только на handshake и socket.data, поэтому описываем
// сокет структурно — так один и тот же обработчик подходит обоим
// неймспейсам (/room и /mafia) без приведения типов.
interface AuthenticatingSocket {
  handshake: { auth: unknown };
  data: SocketData;
}

const secret = process.env.WS_TOKEN_SECRET;
if (!secret) {
  throw new Error("WS_TOKEN_SECRET is required (см. .env в корне монорепо)");
}

export function authMiddleware(
  socket: AuthenticatingSocket,
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
  socket.data.game = payload.game;
  next();
}
