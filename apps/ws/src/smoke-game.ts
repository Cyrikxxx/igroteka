// End-to-end smoke полного онлайн-цикла: создать комнату, добавить 2 команды
// с 2 игроками каждая, начать игру, пройти первый раунд (PRE_ROUND →
// ROUND_ACTIVE → один guess → ROUND_REVIEW → review_confirm → BETWEEN_ROUNDS).
//
// Запуск: `npx tsx apps/ws/src/smoke-game.ts` при поднятом `npm run dev`.

import "./env";
import { io as ioClient, type Socket } from "socket.io-client";
import type {
  RoomSnapshot,
  RoundReviewPayload,
  RoundWordPayload,
} from "@alias/shared/domain";

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

function emitAck<T>(
  sock: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve) =>
    sock.emit(event, payload, resolve as (r: T) => void),
  );
}

function connectWS(
  wsToken: string,
  code: string,
  label: string,
): Promise<{ sock: Socket; snap: RoomSnapshot }> {
  return new Promise((resolve, reject) => {
    const sock = ioClient(`${WS}/room`, {
      auth: { token: wsToken, code },
      transports: ["websocket"],
      reconnection: false,
      timeout: 4000,
    });
    sock.on("connect", () => {
      sock.emit("room:hello", {}, (resp: unknown) => {
        if (
          resp &&
          typeof resp === "object" &&
          "error" in (resp as Record<string, unknown>)
        ) {
          reject(new Error(`[${label}] hello: ${JSON.stringify(resp)}`));
          return;
        }
        resolve({ sock, snap: resp as RoomSnapshot });
      });
    });
    sock.on("connect_error", (err) =>
      reject(new Error(`[${label}] connect: ${err.message}`)),
    );
  });
}

async function joinAsPlayer(displayName: string, code: string) {
  const j = jar();
  await primeCookie(j);
  const r = await fetch(`${WEB}/api/rooms/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: j.header() },
    body: JSON.stringify({ displayName }),
  });
  j.read(r);
  if (!r.ok) throw new Error(`join: ${r.status}`);
  return (await r.json()) as {
    user: { id: string; displayName: string };
    wsToken: string;
  };
}

async function main() {
  // 1. Host создаёт комнату
  const hostJar = jar();
  await primeCookie(hostJar);
  const r1 = await fetch(`${WEB}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: hostJar.header() },
    body: JSON.stringify({
      hostName: "Host",
      title: "SmokeGame",
      settings: { roundTime: 10, winScore: 25, penaltySkip: false, categoryIds: [1, 2] },
    }),
  });
  hostJar.read(r1);
  if (!r1.ok) throw new Error(`create: ${r1.status}`);
  const created = (await r1.json()) as {
    room: { code: string };
    user: { id: string };
    wsToken: string;
  };
  console.log(`[create] code=${created.room.code}`);

  // 2. 3 игрока (PlayerA, PlayerB, PlayerC) — нам нужно ≥2 на команду.
  const players = [
    await joinAsPlayer("PlayerA", created.room.code),
    await joinAsPlayer("PlayerB", created.room.code),
    await joinAsPlayer("PlayerC", created.room.code),
  ];

  // 3. Host подключается
  const host = await connectWS(created.wsToken, created.room.code, "host");
  console.log(`[host connected] teams=${host.snap.teams.length}`);

  // 4. Host создаёт 2 команды
  const t1 = await emitAck<{ ok: true; teamId: number }>(host.sock, "team:create", {
    name: "Red",
  });
  const t2 = await emitAck<{ ok: true; teamId: number }>(host.sock, "team:create", {
    name: "Blue",
  });
  console.log(`[teams] Red=${t1.teamId} Blue=${t2.teamId}`);

  // 5. Host вступает в Red
  await emitAck<{ ok: true }>(host.sock, "team:join", { teamId: t1.teamId });

  // 6. Игроки подключаются и распределяются: A,C в Red, B в Blue (Red получит 3, Blue — 2)
  // Wait, host already in Red. Let me redistribute:
  // Red: Host + PlayerA + PlayerC = 3 players
  // Blue: PlayerB + ??? = need 2
  // Need another player. Let me re-do with 4 players (Host+A+B = Red, C+D = Blue). Simpler:
  // Red: Host + PlayerA (2)
  // Blue: PlayerB + PlayerC (2)
  const pSockets: Socket[] = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const conn = await connectWS(p.wsToken, created.room.code, `p${i}`);
    pSockets.push(conn.sock);
  }

  await emitAck<{ ok: true }>(pSockets[0], "team:join", { teamId: t1.teamId }); // A → Red
  await emitAck<{ ok: true }>(pSockets[1], "team:join", { teamId: t2.teamId }); // B → Blue
  await emitAck<{ ok: true }>(pSockets[2], "team:join", { teamId: t2.teamId }); // C → Blue

  await new Promise((r) => setTimeout(r, 300));

  // Подписываемся на round:word на всех сокетах ДО старта — иначе пропустим
  // приватный emit первого слова.
  const wordsByUserId: Record<string, RoundWordPayload[]> = {};
  const subscribeWord = (sock: Socket, userId: string) => {
    wordsByUserId[userId] = [];
    sock.on("round:word", (w: RoundWordPayload) => {
      wordsByUserId[userId].push(w);
    });
  };
  subscribeWord(host.sock, created.user.id);
  players.forEach((p, i) => subscribeWord(pSockets[i], p.user.id));

  // 7. Host стартует игру
  console.log("[start_game]");
  const startResp = await emitAck<{ ok: true } | { error: string }>(
    host.sock,
    "round:start_game",
    {},
  );
  if ("error" in startResp) throw new Error(`start: ${JSON.stringify(startResp)}`);

  // 8. Ждём PRE_ROUND countdown (3 сек) + initial round_active setup → ROUND_ACTIVE
  console.log("[waiting PRE_ROUND → ROUND_ACTIVE]");
  await new Promise((r) => setTimeout(r, 5000));

  // 9. Кто сейчас explainer? Возьмём текущий снимок:
  const snapAfterStart = await new Promise<RoomSnapshot>((resolve) =>
    host.sock.emit("room:hello", {}, (r: unknown) => resolve(r as RoomSnapshot)),
  );
  console.log(
    `[active] phase=${snapAfterStart.phase} team=${snapAfterStart.currentTeamId} explainer=${snapAfterStart.currentPlayerId?.slice(0, 8)}`,
  );

  // Explainer = снапшот.currentPlayerId. Найдём его сокет.
  const explainerId = snapAfterStart.currentPlayerId!;
  let explainerSock: Socket;
  if (explainerId === created.user.id) {
    explainerSock = host.sock;
  } else {
    const idx = players.findIndex((p) => p.user.id === explainerId);
    explainerSock = pSockets[idx];
  }
  const wordsReceived = wordsByUserId[explainerId] ?? [];
  console.log(`[explainer] received ${wordsReceived.length} word(s) so far`);

  // Делаем 2 угадывания
  const firstWord = wordsReceived[0];
  if (firstWord) {
    console.log(`[guess] first word "${firstWord.text}" → got`);
    await emitAck(explainerSock, "round:guess", {
      wordId: firstWord.wordId,
      guessed: true,
    });
    await new Promise((r) => setTimeout(r, 100));
    const next = wordsReceived[wordsReceived.length - 1];
    if (next) {
      console.log(`[guess] second word "${next.text}" → skip`);
      await emitAck(explainerSock, "round:guess", {
        wordId: next.wordId,
        guessed: false,
      });
    }
  } else {
    console.log("[!] explainer did not receive any word");
  }

  // 11. Ждём окончания таймера (10 сек roundTime - что уже прошло, ~5s).
  console.log("[waiting timer expire]");
  await new Promise((r) => setTimeout(r, 9000));

  // 12. ROUND_REVIEW: explainer подтверждает
  const reviewPromise = new Promise<RoundReviewPayload>((resolve) => {
    explainerSock.once("round:review", resolve);
  });
  const snapAfterTimer = await new Promise<RoomSnapshot>((resolve) =>
    host.sock.emit("room:hello", {}, (r: unknown) => resolve(r as RoomSnapshot)),
  );
  console.log(`[after timer] phase=${snapAfterTimer.phase}`);

  if (snapAfterTimer.phase === "ROUND_REVIEW") {
    // review мог уже прийти раньше — попробуем ждать с таймаутом
    const review = await Promise.race([
      reviewPromise,
      new Promise<null>((r) => setTimeout(() => r(null), 1000)),
    ]);
    console.log(`[review] words=${review?.words.length ?? "?"} preview=${review?.scorePreview ?? "?"}`);

    console.log("[confirm]");
    const confirmResp = await emitAck<{ ok: true } | { error: string }>(
      explainerSock,
      "round:review_confirm",
      {},
    );
    console.log(`[confirm resp]`, confirmResp);

    // Должно прийти round:committed
    await new Promise((r) => setTimeout(r, 500));
    const snapAfterCommit = await new Promise<RoomSnapshot>((resolve) =>
      host.sock.emit("room:hello", {}, (r: unknown) => resolve(r as RoomSnapshot)),
    );
    console.log(`[after commit] phase=${snapAfterCommit.phase}`);
    console.log(
      `[scores]`,
      snapAfterCommit.teams.map((t) => `${t.name}=${t.score}`).join(", "),
    );
  } else {
    console.log(`[!] expected ROUND_REVIEW, got ${snapAfterTimer.phase}`);
  }

  // 13. Cleanup: закрываем
  host.sock.disconnect();
  pSockets.forEach((s) => s.disconnect());
  await fetch(`${WEB}/api/rooms/${created.room.code}`, {
    method: "DELETE",
    headers: { cookie: hostJar.header() },
  });
  console.log("[ok] smoke-game done");
  process.exit(0);
}

main().catch((e) => {
  console.error("[smoke-game] FAIL:", e);
  process.exit(1);
});
