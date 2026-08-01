// Помощник для подписи WS-токенов из REST-эндпоинтов apps/web
// (`POST /api/rooms` и `POST /api/rooms/[code]/join`).
//
// Секрет — из `process.env.WS_TOKEN_SECRET`, общий с apps/ws.

import {
  signWsToken,
  type WsRole,
  type WsGame,
  WS_TOKEN_TTL_MS,
} from "@alias/shared/token";
import type { NextRequest } from "next/server";

function getSecret(): string {
  const s = process.env.WS_TOKEN_SECRET;
  if (!s) {
    throw new Error(
      "WS_TOKEN_SECRET is not set. Добавь его в .env в корне монорепо " +
        "(см. .env.example). Значение должно совпадать у web и ws.",
    );
  }
  return s;
}

export function issueWsToken(args: {
  userId: string;
  roomCode: string;
  role: WsRole;
  game?: WsGame;
  ttlMs?: number;
}): string {
  return signWsToken(
    {
      userId: args.userId,
      roomCode: args.roomCode,
      role: args.role,
      game: args.game ?? "alias",
    },
    getSecret(),
    args.ttlMs ?? WS_TOKEN_TTL_MS,
  );
}

/**
 * Адрес WS-сервера, который получит браузер.
 *
 * - `NEXT_PUBLIC_WS_URL` задан — отдаём его как есть (нужно, если ws вынесен
 *   на отдельный домен).
 * - production без переменной — пустая строка. На VPS web и ws стоят за одним
 *   реверс-прокси, и клиент подключается к origin страницы: socket.io
 *   получает относительный адрес вида `/mafia` и сам подставит нужную схему
 *   (wss:// на https-странице) и порт. Собирать URL руками нельзя —
 *   за прокси ни схема, ни порт приложению не известны.
 * - development — LAN-осознанный адрес: если страницу открыли с телефона по
 *   `http://192.168.1.5:3000`, ws должен быть `http://192.168.1.5:3001`, а не
 *   `localhost`, иначе телефон будет стучаться сам в себя.
 */
export function wsConnectUrlFor(request: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") return "";

  const host = request.headers.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0];
  const isLoopback =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";

  return isLoopback ? "http://localhost:3001" : `http://${hostname}:3001`;
}
