// Socket.io сервер для онлайн-комнат Alias. См. PROMPT.md §2.1.1, §2.4.

import "./env";

import { createServer } from "node:http";
import { Server } from "socket.io";
import { redis } from "./redis";
import { authMiddleware } from "./auth";
import { registerLobbyHandlers } from "./handlers/lobby";
import { registerRoundHandlers } from "./handlers/round";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./types";
import type { AppNamespace } from "./io-types";

// Railway передаёт порт через стандартную `PORT`. Локально используем
// `WS_PORT=3001`, чтобы не конфликтовать с Next.js на 3000.
const PORT = Number(process.env.PORT ?? process.env.WS_PORT ?? 3001);
// В dev разрешаем любой origin — иначе телефон на LAN (192.168.x.x)
// блокируется CORS, когда подключается к WS на том же роутере.
// В production обязателен WS_CORS_ORIGIN с URL Vercel-приложения
// (например, https://alias-online.vercel.app). Несколько origin'ов
// через запятую: "https://alias.vercel.app,https://alias-preview.vercel.app".
function resolveCorsOrigin(): string | string[] | true {
  const env = process.env.WS_CORS_ORIGIN;
  if (env) {
    const parts = env.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length === 1 ? parts[0] : parts;
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[ws] WARNING: WS_CORS_ORIGIN is not set in production. " +
        "Falling back to closed CORS. Set it to the Vercel app URL.",
    );
    return "https://example.invalid"; // заведомо несовпадающий — заблокирует всё
  }
  return true; // dev: open CORS
}
const CORS_ORIGIN = resolveCorsOrigin();

const httpServer = createServer(async (req, res) => {
  if (req.url === "/health" || req.url === "/") {
    try {
      const pong = await redis.ping();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, redis: pong, uptime: process.uptime() }));
    } catch (err) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
    }
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
  path: "/socket.io",
});

const roomNs: AppNamespace = io.of("/room");
roomNs.use(authMiddleware);

roomNs.on("connection", (socket) => {
  const { userId, roomCode, role } = socket.data;
  console.log(
    `[ws] connect userId=${userId.slice(0, 8)} room=${roomCode} role=${role} sid=${socket.id}`,
  );
  void socket.join(`room:${roomCode}`);

  registerLobbyHandlers(roomNs, socket);
  registerRoundHandlers(roomNs, socket);

  socket.on("disconnect", (reason) => {
    console.log(
      `[ws] disconnect userId=${userId.slice(0, 8)} room=${roomCode} reason=${reason}`,
    );
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[ws] listening on http://0.0.0.0:${PORT}`);
  console.log(`[ws] CORS origin: ${CORS_ORIGIN === true ? "*" : CORS_ORIGIN}`);
});

function shutdown(reason: string): void {
  console.log(`[ws] shutting down (${reason})`);
  io.close();
  httpServer.close();
  redis.quit().catch(() => {});
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
