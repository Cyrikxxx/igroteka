// Помощник для подписи WS-токенов из REST-эндпоинтов apps/web
// (`POST /api/rooms` и `POST /api/rooms/[code]/join`).
//
// Секрет — из `process.env.WS_TOKEN_SECRET`, общий с apps/ws.

import { signWsToken, type WsRole, WS_TOKEN_TTL_MS } from "@alias/shared/token";
import type { NextRequest } from "next/server";

function getSecret(): string {
  const s = process.env.WS_TOKEN_SECRET;
  if (!s) {
    throw new Error(
      "WS_TOKEN_SECRET is not set. Добавь его в .env (см. STATUS.md Сессия 5).",
    );
  }
  return s;
}

export function issueWsToken(args: {
  userId: string;
  roomCode: string;
  role: WsRole;
  ttlMs?: number;
}): string {
  return signWsToken(
    { userId: args.userId, roomCode: args.roomCode, role: args.role },
    getSecret(),
    args.ttlMs ?? WS_TOKEN_TTL_MS,
  );
}

/**
 * URL WS-сервера для клиента.
 *
 * - В production: всегда `NEXT_PUBLIC_WS_URL` (например, Railway-домен).
 * - В development: если запрос пришёл на `localhost` — отдаём
 *   `http://localhost:3001`. Если же страницу открыли по LAN-адресу
 *   (например, с телефона `http://192.168.1.5:3000`), отдаём
 *   `http://192.168.1.5:3001` — иначе на телефоне Socket.io попытается
 *   подключиться к самому себе и тихо не подключится.
 */
export function wsConnectUrlFor(request: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  // В production — всегда явный URL.
  if (process.env.NODE_ENV === "production" && explicit) return explicit;

  const host = request.headers.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0];

  // Если хост — это localhost / 127.0.0.1, доверяем NEXT_PUBLIC_WS_URL.
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  ) {
    return explicit ?? "http://localhost:3001";
  }

  // LAN-доступ — собираем URL с тем же хостом, что и страница.
  return `http://${hostname}:3001`;
}
