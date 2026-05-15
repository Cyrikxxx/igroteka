// Подписанные токены для WebSocket-аутентификации.
// REST-эндпоинт (apps/web) подписывает токен HMAC'ом и отдаёт клиенту.
// WS-сервер (apps/ws) верифицирует ту же подпись тем же секретом.
// Формат: `<base64url(payload)>.<base64url(hmacSha256)>` (без header — мы не
// меняем алгоритм, поэтому JWT-обвязка не нужна).
//
// См. PROMPT.md §2.6.4.

import { createHmac, timingSafeEqual } from "node:crypto";

export type WsRole = "host" | "player";

export interface WsTokenPayload {
  userId: string;
  roomCode: string;
  role: WsRole;
  /** Unix-ms expiration. */
  exp: number;
}

export const WS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 час

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function signWsToken(
  payload: Omit<WsTokenPayload, "exp"> & { exp?: number },
  secret: string,
  ttlMs: number = WS_TOKEN_TTL_MS,
): string {
  if (!secret) throw new Error("signWsToken: empty secret");
  const full: WsTokenPayload = {
    userId: payload.userId,
    roomCode: payload.roomCode,
    role: payload.role,
    exp: payload.exp ?? Date.now() + ttlMs,
  };
  const body = b64url(JSON.stringify(full));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyWsToken(token: unknown, secret: string): WsTokenPayload | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  const expected = b64url(createHmac("sha256", secret).update(body).digest());
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromB64url(body).toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (
    typeof p.userId !== "string" ||
    !p.userId ||
    typeof p.roomCode !== "string" ||
    !p.roomCode ||
    (p.role !== "host" && p.role !== "player") ||
    typeof p.exp !== "number"
  ) {
    return null;
  }
  if (Date.now() > p.exp) return null;
  return {
    userId: p.userId,
    roomCode: p.roomCode,
    role: p.role,
    exp: p.exp,
  };
}
