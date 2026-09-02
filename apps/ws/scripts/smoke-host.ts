// Права хоста при обрыве связи и при выходе — в обеих играх.
//
// Проверяет то, ради чего всё это делалось:
//   • у хоста моргнула сеть — он остаётся хостом;
//   • забрать комнату раньше минуты нельзя;
//   • хост вернулся — отсчёт снят, забирать больше нечего;
//   • хост вышел кнопкой — комната достаётся тому, кто на связи;
//   • наследником становится онлайн-игрок, а не первый по списку.
//
// Минуту вживую не ждём: отметку «хост пропал» отматываем назад прямо в
// Redis — сервер сверяет её по своим часам, и для него это неотличимо от
// честно прошедшей минуты.
//
// Запуск: `npm run smoke:host -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { RoomSnapshot } from "@alias/shared/domain";
import type { MafiaView } from "@alias/shared/mafia";
import { HOST_CLAIM_AFTER_MS } from "@alias/shared/constants";
import { roomKey, mafiaRoomKey } from "@alias/shared/redis-keys";
import redis from "../src/redis";

const WEB = "http://localhost:3000";
const WS = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function assert(ok: boolean, what: string) {
  if (!ok) throw new Error(`ПРОВАЛ: ${what}`);
  console.log(`  ok · ${what}`);
}

/** Отдельная «вкладка»: своя кука `aid`, то есть свой человек. */
function tab() {
  const jar = new Map<string, string>();
  const read = (res: Response) => {
    const sc = res.headers.get("set-cookie");
    if (sc) {
      const m = sc.match(/^([^=]+)=([^;]+)/);
      if (m) jar.set(m[1], m[2]);
    }
  };
  const cookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  return {
    async prime() {
      read(await fetch(`${WEB}/api/categories`));
    },
    async post(path: string, body: unknown) {
      const res = await fetch(`${WEB}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookie() },
        body: JSON.stringify(body),
      });
      read(res);
      return res;
    },
  };
}

/**
 * Отматывает «хост пропал» на минуту с лишним назад — чтобы не ждать её
 * вживую. Сервер сверяет отметку по своим часам, для него это то же самое.
 */
async function backdateHostOffline(key: string): Promise<void> {
  const raw = await redis.get(key);
  if (!raw) throw new Error(`нет снапшота ${key}`);
  const snap = JSON.parse(raw) as { hostOfflineSince?: number | null };
  snap.hostOfflineSince = Date.now() - HOST_CLAIM_AFTER_MS - 1_000;
  await redis.set(key, JSON.stringify(snap), "KEEPTTL");
}

function emitAck<T>(sock: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => sock.emit(event, payload, resolve as (r: T) => void));
}

function connect(ns: string, token: string, code: string, name?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = ioClient(`${WS}${ns}`, {
      auth: { token, code, name },
      transports: ["websocket"],
      reconnection: false,
      timeout: 4000,
    });
    sock.on("connect", () => resolve(sock));
    sock.on("connect_error", (e) => reject(new Error(`connect: ${e.message}`)));
  });
}

// ─────────────────────────── Мафия ───────────────────────────

async function mafiaScenario() {
  console.log("\n[мафия]");
  const hostTab = tab();
  await hostTab.prime();
  const created = (await (
    await hostTab.post("/api/mafia/rooms", { hostName: "Хост", title: "Host" })
  ).json()) as { room: { code: string }; user: { id: string }; wsToken: string };
  const code = created.room.code;

  let hostSock = await connect("/mafia", created.wsToken, code, "Хост");
  await emitAck(hostSock, "mafia:hello", {});

  const guestTab = tab();
  await guestTab.prime();
  const guest = (await (
    await guestTab.post(`/api/mafia/rooms/${code}/join`, { displayName: "Гость" })
  ).json()) as { user: { id: string }; wsToken: string };
  const guestSock = await connect("/mafia", guest.wsToken, code, "Гость");
  const v0 = (await emitAck(guestSock, "mafia:hello", {})) as MafiaView;
  assert(v0.hostId === created.user.id, "комната у создателя");

  // Хост теряет сеть.
  hostSock.disconnect();
  await sleep(400);
  const v1 = (await emitAck(guestSock, "mafia:hello", {})) as MafiaView;
  assert(v1.hostId === created.user.id, "обрыв связи хоста комнату не отбирает");
  assert(typeof v1.hostOfflineSince === "number", "запущен отсчёт «хост не в сети»");

  const early = await emitAck<{ error?: string }>(guestSock, "mafia:claim_host", {});
  assert(early.error === "host_is_here", "забрать комнату раньше срока нельзя");

  // Минута прошла — комнату можно забрать.
  await backdateHostOffline(mafiaRoomKey(code));
  const claimed = await emitAck<{ ok?: true; error?: string }>(guestSock, "mafia:claim_host", {});
  assert(claimed.ok === true, "после минуты комнату можно забрать");
  await sleep(300);
  const vClaim = (await emitAck(guestSock, "mafia:hello", {})) as MafiaView;
  assert(vClaim.hostId === guest.user.id, "комната перешла тому, кто забрал");
  assert(vClaim.you.isHost === true, "у него появились права хоста");
  assert(!vClaim.hostOfflineSince, "отсчёт снят вместе с передачей");

  // Возвращаем комнату исходному хосту, чтобы проверить остальные сценарии.
  await emitAck(guestSock, "mafia:transfer_host", { userId: created.user.id });
  await sleep(200);

  // Хост вернулся.
  hostSock = await connect("/mafia", created.wsToken, code, "Хост");
  await emitAck(hostSock, "mafia:hello", {});
  await sleep(300);
  const v2 = (await emitAck(guestSock, "mafia:hello", {})) as MafiaView;
  assert(v2.hostId === created.user.id, "вернувшийся хост остался хостом");
  assert(!v2.hostOfflineSince, "отсчёт снят — забирать нечего");

  // Хост выходит кнопкой.
  await emitAck(hostSock, "mafia:leave", {});
  await sleep(400);
  const v3 = (await emitAck(guestSock, "mafia:hello", {})) as MafiaView;
  assert(v3.hostId === guest.user.id, "выход кнопкой передаёт комнату тому, кто на связи");
  assert(v3.you.isHost === true, "у нового хоста появились права");
  assert(
    !v3.players.some((p) => p.userId === created.user.id),
    "вышедший из комнаты пропал",
  );

  guestSock.disconnect();
}

// ─────────────────────────── Алиас ───────────────────────────

async function aliasScenario() {
  console.log("\n[алиас]");
  const catalog = (await (await fetch(`${WEB}/api/categories`)).json()) as {
    levels: { id: number }[];
  };
  const categoryIds = [catalog.levels[0].id];

  const hostTab = tab();
  await hostTab.prime();
  const created = (await (
    await hostTab.post("/api/rooms", {
      hostName: "Хост",
      title: "Host",
      settings: { roundTime: 60, winScore: 50, penaltySkip: false, categoryIds },
    })
  ).json()) as { room: { code: string }; user: { id: string }; wsToken: string };
  const code = created.room.code;

  let hostSock = await connect("/room", created.wsToken, code);
  await emitAck(hostSock, "room:hello", {});

  const guestTab = tab();
  await guestTab.prime();
  const guest = (await (
    await guestTab.post(`/api/rooms/${code}/join`, { displayName: "Гость" })
  ).json()) as { user: { id: string }; wsToken: string };
  const guestSock = await connect("/room", guest.wsToken, code);
  await emitAck(guestSock, "room:hello", {});

  hostSock.disconnect();
  await sleep(400);
  const s1 = (await emitAck(guestSock, "room:hello", {})) as RoomSnapshot;
  assert(s1.hostId === created.user.id, "обрыв связи хоста комнату не отбирает");
  assert(typeof s1.hostOfflineSince === "number", "запущен отсчёт «хост не в сети»");

  const early = await emitAck<{ error?: string }>(guestSock, "room:claim_host", {});
  assert(early.error === "host_is_here", "забрать комнату раньше срока нельзя");

  // Минута прошла — комнату можно забрать.
  await backdateHostOffline(roomKey(code));
  const claimed = await emitAck<{ ok?: true; error?: string }>(guestSock, "room:claim_host", {});
  assert(claimed.ok === true, "после минуты комнату можно забрать");
  await sleep(300);
  const sClaim = (await emitAck(guestSock, "room:hello", {})) as RoomSnapshot;
  assert(sClaim.hostId === guest.user.id, "комната перешла тому, кто забрал");
  assert(!sClaim.hostOfflineSince, "отсчёт снят вместе с передачей");

  // Возвращаем комнату исходному хосту, чтобы проверить остальные сценарии.
  await emitAck(guestSock, "room:transfer_host", { userId: created.user.id });
  await sleep(200);

  hostSock = await connect("/room", created.wsToken, code);
  await emitAck(hostSock, "room:hello", {});
  await sleep(300);
  const s2 = (await emitAck(guestSock, "room:hello", {})) as RoomSnapshot;
  assert(s2.hostId === created.user.id, "вернувшийся хост остался хостом");
  assert(!s2.hostOfflineSince, "отсчёт снят — забирать нечего");

  await emitAck(hostSock, "room:leave", {});
  await sleep(400);
  const s3 = (await emitAck(guestSock, "room:hello", {})) as RoomSnapshot;
  assert(s3.hostId === guest.user.id, "выход кнопкой передаёт комнату тому, кто на связи");
  const everyone = [...s3.teams.flatMap((t) => t.players), ...s3.spectators];
  assert(
    !everyone.some((p) => p.userId === created.user.id),
    "вышедший из комнаты пропал",
  );

  guestSock.disconnect();
}

// ───────────────────── Пустая комната и зомби-код ─────────────────────

async function emptyRoomScenario() {
  console.log("\n[пустая комната]");
  const catalog = (await (await fetch(`${WEB}/api/categories`)).json()) as {
    levels: { id: number }[];
  };
  const hostTab = tab();
  await hostTab.prime();
  const created = (await (
    await hostTab.post("/api/rooms", {
      hostName: "Один",
      title: "Empty",
      settings: {
        roundTime: 60,
        winScore: 50,
        penaltySkip: false,
        categoryIds: [catalog.levels[0].id],
      },
    })
  ).json()) as { room: { code: string }; wsToken: string };
  const code = created.room.code;

  const sock = await connect("/room", created.wsToken, code);
  await emitAck(sock, "room:hello", {});

  // Пока человек на связи — комната живёт сутки.
  const ttlOnline = await redis.ttl(roomKey(code));
  assert(ttlOnline > 3600, `с живым игроком комната живёт долго (ttl=${ttlOnline})`);

  // Отвалился, но не выходил — комнате остаются минуты, а не сутки.
  sock.disconnect();
  await sleep(500);
  const ttlOffline = await redis.ttl(roomKey(code));
  assert(
    ttlOffline > 0 && ttlOffline <= 600,
    `без людей на связи комната живёт минуты (ttl=${ttlOffline})`,
  );

  // Вернулся — срок снова длинный.
  const back = await connect("/room", created.wsToken, code);
  await emitAck(back, "room:hello", {});
  await sleep(300);
  const ttlBack = await redis.ttl(roomKey(code));
  assert(ttlBack > 3600, `вернувшийся продлевает жизнь комнаты (ttl=${ttlBack})`);

  // Вышел кнопкой — последний, значит комнату закрываем сразу.
  await emitAck(back, "room:leave", {});
  await sleep(500);
  const gone = await redis.get(roomKey(code));
  assert(gone === null, "уход последнего закрывает комнату сразу");

  const afterClose = await hostTab.post(`/api/rooms/${code}/join`, { displayName: "Кто-то" });
  assert(afterClose.status === 410, "по коду закрытой комнаты больше не пускают");

  // Зомби-код: строка комнаты в LOBBY, а снапшот протух.
  const zombie = (await (
    await hostTab.post("/api/rooms", {
      hostName: "Зомби",
      title: "Zombie",
      settings: {
        roundTime: 60,
        winScore: 50,
        penaltySkip: false,
        categoryIds: [catalog.levels[0].id],
      },
    })
  ).json()) as { room: { code: string } };
  await redis.del(roomKey(zombie.room.code));
  const zombieJoin = await hostTab.post(`/api/rooms/${zombie.room.code}/join`, {
    displayName: "Кто-то",
  });
  assert(zombieJoin.status === 410, "по протухшему коду отвечаем «комната закрыта», а не 200");
}

async function main() {
  await mafiaScenario();
  await aliasScenario();
  await emptyRoomScenario();
  console.log("\n[smoke-host] все проверки зелёные");
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n[smoke-host] ${(e as Error).message}`);
  process.exit(1);
});
