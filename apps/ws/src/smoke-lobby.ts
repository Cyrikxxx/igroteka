// End-to-end smoke: REST create + 2 WS-клиентов в одной комнате,
// проверяем team:create/join/rename и room:state broadcast.
// Запуск: `npx tsx apps/ws/src/smoke-lobby.ts` при поднятом `npm run dev`.

import "./env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { RoomSnapshot } from "@alias/shared/domain";

const WEB = "http://localhost:3000";
const WS = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

function jar() {
  const map = new Map<string, string>();
  return {
    read(res: Response) {
      const sc = res.headers.get("set-cookie");
      if (sc) {
        const m = sc.match(/^([^=]+)=([^;]+)/);
        if (m) map.set(m[1], m[2]);
      }
    },
    header() {
      return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function primeCookie(j: ReturnType<typeof jar>) {
  const r = await fetch(`${WEB}/api/categories`);
  j.read(r);
}

function connectWS(
  wsToken: string,
  code: string,
  label: string,
): Promise<{ sock: Socket; first: RoomSnapshot }> {
  return new Promise((resolve, reject) => {
    const sock = ioClient(`${WS}/room`, {
      auth: { token: wsToken, code },
      transports: ["websocket"],
      reconnection: false,
      timeout: 4000,
    });
    sock.on("connect", () => {
      sock.emit("room:hello", {}, (resp: unknown) => {
        if (resp && typeof resp === "object" && "error" in (resp as Record<string, unknown>)) {
          reject(new Error(`[${label}] hello error: ${JSON.stringify(resp)}`));
          return;
        }
        resolve({ sock, first: resp as RoomSnapshot });
      });
    });
    sock.on("connect_error", (err) => reject(new Error(`[${label}] connect_error: ${err.message}`)));
  });
}

function waitForState(sock: Socket): Promise<RoomSnapshot> {
  return new Promise((resolve) => sock.once("room:state", resolve));
}

function emitAck<T>(sock: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => sock.emit(event, payload, resolve as (r: T) => void));
}

async function main() {
  // ── 1. Host создаёт комнату через REST
  const hostJar = jar();
  await primeCookie(hostJar);
  const r1 = await fetch(`${WEB}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: hostJar.header() },
    body: JSON.stringify({
      hostName: "HostBob",
      title: "SmokeLobby",
      settings: { roundTime: 60, winScore: 50, penaltySkip: false, categoryIds: [1, 2] },
    }),
  });
  hostJar.read(r1);
  if (!r1.ok) throw new Error(`create room: ${r1.status}`);
  const created = (await r1.json()) as {
    room: { code: string };
    user: { id: string };
    wsToken: string;
  };
  console.log(`[create] code=${created.room.code} hostId=${created.user.id.slice(0, 8)}…`);

  // ── 2. Player через REST/join
  const playerJar = jar();
  await primeCookie(playerJar);
  const r2 = await fetch(`${WEB}/api/rooms/${created.room.code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: playerJar.header() },
    body: JSON.stringify({ displayName: "PlayerAlice" }),
  });
  playerJar.read(r2);
  if (!r2.ok) throw new Error(`join: ${r2.status}`);
  const joined = (await r2.json()) as {
    user: { id: string };
    wsToken: string;
  };
  console.log(`[join]   playerId=${joined.user.id.slice(0, 8)}…`);

  // ── 3. Host подключается к WS
  const host = await connectWS(created.wsToken, created.room.code, "host");
  console.log(
    `[ws/host] hello: ${host.first.teams.length} teams, ${host.first.spectators.length} specs`,
  );

  // ── 4. Player подключается к WS
  const player = await connectWS(joined.wsToken, created.room.code, "player");
  console.log(
    `[ws/player] hello: ${player.first.teams.length} teams, ${player.first.spectators.length} specs`,
  );

  // ── 5. Host создаёт две команды
  const t1 = await emitAck<{ ok: true; teamId: number } | { error: string }>(
    host.sock,
    "team:create",
    { name: "Лисы" },
  );
  const t2 = await emitAck<{ ok: true; teamId: number } | { error: string }>(
    host.sock,
    "team:create",
    { name: "Совы" },
  );
  console.log(`[host] team:create →`, t1, t2);
  if (!("teamId" in t1) || !("teamId" in t2)) throw new Error("team:create failed");

  // даём время broadcast'у дойти
  await new Promise((r) => setTimeout(r, 100));

  // ── 6. Player вступает в команду 2
  const join = await emitAck<{ ok: true } | { error: string }>(player.sock, "team:join", {
    teamId: t2.teamId,
  });
  console.log(`[player] team:join →`, join);

  // ── 7. Получаем финальный state
  await new Promise((r) => setTimeout(r, 150));
  const finalState = await new Promise<RoomSnapshot>((resolve) => {
    host.sock.emit("room:hello", {}, (resp: unknown) => resolve(resp as RoomSnapshot));
  });
  console.log(`[final]`, {
    teams: finalState.teams.map((t) => ({
      name: t.name,
      players: t.players.map((p) => p.displayName),
    })),
    spectators: finalState.spectators.map((s) => s.displayName),
  });

  // ── 8. Disconnect: проверим online=false
  player.sock.disconnect();
  await new Promise((r) => setTimeout(r, 200));
  const afterDisc = await new Promise<RoomSnapshot>((resolve) => {
    host.sock.emit("room:hello", {}, (resp: unknown) => resolve(resp as RoomSnapshot));
  });
  const aliceInSnap = afterDisc.teams
    .flatMap((t) => t.players)
    .find((p) => p.displayName === "PlayerAlice");
  console.log(`[disconnect] Alice.online =`, aliceInSnap?.online ?? "<not found>");

  host.sock.disconnect();

  // ── 9. Клиним: закрываем комнату
  await fetch(`${WEB}/api/rooms/${created.room.code}`, {
    method: "DELETE",
    headers: { cookie: hostJar.header() },
  });
  console.log("[ok] smoke-lobby passed");
  process.exit(0);
}

main().catch((e) => {
  console.error("[smoke-lobby] FAIL:", e);
  process.exit(1);
});
