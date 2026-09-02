// Возвращение в комнату, смена ника и блокировка — в обеих играх.
//
// Проверяет ровно то, что чинилось:
//   • закрыл вкладку и вернулся по ссылке — имя не спрашивают;
//   • имя, введённое заново, применяется, а не теряется;
//   • ник меняется прямо в лобби;
//   • выгнанного отключают, и он не может войти обратно;
//   • разблокировка лишь открывает вход: сама она никого не возвращает.
//
// Запуск: `npm run smoke:rejoin -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { RoomSnapshot } from "@alias/shared/domain";
import type { MafiaView } from "@alias/shared/mafia";

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
    cookie,
    async post(path: string, body: unknown): Promise<Response> {
      const res = await fetch(`${WEB}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookie() },
        body: JSON.stringify(body),
      });
      read(res);
      return res;
    },
    async prime() {
      read(await fetch(`${WEB}/api/categories`));
    },
  };
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

async function categoryIds(): Promise<number[]> {
  const catalog = (await (await fetch(`${WEB}/api/categories`)).json()) as {
    levels: { id: number }[];
  };
  return [catalog.levels[0].id];
}

// ─────────────────────────── Мафия ───────────────────────────

async function mafiaScenario() {
  console.log("\n[мафия]");
  const host = tab();
  await host.prime();
  const created = (await (
    await host.post("/api/mafia/rooms", { hostName: "Хост", title: "Rejoin" })
  ).json()) as { room: { code: string }; user: { id: string }; wsToken: string };
  const code = created.room.code;

  const hostSock = await connect("/mafia", created.wsToken, code, "Хост");
  await emitAck(hostSock, "mafia:hello", {});

  // Игрок заходит в первый раз — имя обязательно.
  const guest = tab();
  await guest.prime();
  const noName = await guest.post(`/api/mafia/rooms/${code}/join`, {});
  assert(noName.status === 400, "новичка без имени не пускают");

  const joined = (await (
    await guest.post(`/api/mafia/rooms/${code}/join`, { displayName: "Гость" })
  ).json()) as { user: { id: string }; wsToken: string };
  let guestSock = await connect("/mafia", joined.wsToken, code, "Гость");
  await emitAck(guestSock, "mafia:hello", {});

  // Закрыли вкладку: сокет отвалился, креды пропали. Возвращаемся без имени.
  guestSock.disconnect();
  await sleep(200);
  const resumeRes = await guest.post(`/api/mafia/rooms/${code}/join`, { resume: true });
  assert(resumeRes.status === 200, "вернувшегося пускают без имени");
  const resumed = (await resumeRes.json()) as { user: { displayName: string }; wsToken: string };
  assert(resumed.user.displayName === "Гость", "имя осталось прежним, спрашивать было не о чем");

  // Имя, введённое заново, должно применяться.
  const renamedRes = await guest.post(`/api/mafia/rooms/${code}/join`, { displayName: "Гостья" });
  const renamed = (await renamedRes.json()) as { user: { displayName: string }; wsToken: string };
  assert(renamed.user.displayName === "Гостья", "введённое заново имя применилось");
  guestSock = await connect("/mafia", renamed.wsToken, code, "Гостья");
  const view1 = (await emitAck(guestSock, "mafia:hello", {})) as MafiaView;
  assert(
    view1.players.some((p) => p.displayName === "Гостья"),
    "новое имя видно в комнате",
  );

  // Смена ника прямо в лобби.
  const setName = await emitAck<{ ok?: true; error?: string }>(guestSock, "mafia:set_name", {
    displayName: "Вера",
  });
  assert(setName.ok === true, "ник меняется в лобби");
  await sleep(200);
  const view2 = (await emitAck(guestSock, "mafia:hello", {})) as MafiaView;
  assert(view2.players.some((p) => p.displayName === "Вера"), "новый ник виден всем");

  // Кик: игрока отключают событием, войти обратно нельзя.
  const closed = new Promise<{ reason: string }>((resolve) =>
    guestSock.once("mafia:closed", resolve),
  );
  const guestId = joined.user.id;
  const kick = await emitAck<{ ok?: true; error?: string }>(hostSock, "mafia:kick", {
    userId: guestId,
  });
  assert(kick.ok === true, "хост выгоняет игрока");
  const closedPayload = await Promise.race([
    closed,
    sleep(1500).then(() => null),
  ]);
  assert(closedPayload?.reason === "kicked", "выгнанному приходит mafia:closed(kicked)");

  const blocked = await guest.post(`/api/mafia/rooms/${code}/join`, { resume: true });
  assert(blocked.status === 403, "выгнанный не может вернуться");
  const blockedText = (await blocked.json()) as { error: string };
  assert(/заблокир/i.test(blockedText.error), `в отказе сказано про блокировку: «${blockedText.error}»`);

  // Разблокировка только открывает вход.
  const unban = await emitAck<{ ok?: true }>(hostSock, "mafia:unban", { userId: guestId });
  assert(unban.ok === true, "хост разблокирует игрока");
  await sleep(200);
  const viewAfterUnban = (await emitAck(hostSock, "mafia:hello", {})) as MafiaView;
  assert(
    !viewAfterUnban.players.some((p) => p.userId === guestId),
    "разблокировка сама никого не возвращает в комнату",
  );
  // Молча вернуться выгнанный не может и после разблокировки: из комнаты его
  // вычеркнули, участником он больше не числится. Заходит как новый — сам.
  const stillNotMember = await guest.post(`/api/mafia/rooms/${code}/join`, { resume: true });
  assert(stillNotMember.status === 400, "разблокированный не втягивается в комнату молча");
  const allowed = await guest.post(`/api/mafia/rooms/${code}/join`, { displayName: "Вера" });
  assert(allowed.status === 200, "после разблокировки он может зайти сам");

  hostSock.disconnect();
}

// ─────────────────────────── Алиас ───────────────────────────

async function aliasScenario() {
  console.log("\n[алиас]");
  const ids = await categoryIds();
  const host = tab();
  await host.prime();
  const created = (await (
    await host.post("/api/rooms", {
      hostName: "Хост",
      title: "Rejoin",
      settings: { roundTime: 60, winScore: 50, penaltySkip: false, categoryIds: ids },
    })
  ).json()) as { room: { code: string }; user: { id: string }; wsToken: string };
  const code = created.room.code;

  const hostSock = await connect("/room", created.wsToken, code);
  await emitAck(hostSock, "room:hello", {});

  const guest = tab();
  await guest.prime();
  const noName = await guest.post(`/api/rooms/${code}/join`, {});
  assert(noName.status === 400, "новичка без имени не пускают");

  const joined = (await (
    await guest.post(`/api/rooms/${code}/join`, { displayName: "Гость" })
  ).json()) as { user: { id: string }; wsToken: string };
  let guestSock = await connect("/room", joined.wsToken, code);
  await emitAck(guestSock, "room:hello", {});

  guestSock.disconnect();
  await sleep(200);
  const resumeRes = await guest.post(`/api/rooms/${code}/join`, { resume: true });
  assert(resumeRes.status === 200, "вернувшегося пускают без имени");
  const resumed = (await resumeRes.json()) as { user: { displayName: string }; wsToken: string };
  assert(resumed.user.displayName === "Гость", "имя осталось прежним");

  const renamed = (await (
    await guest.post(`/api/rooms/${code}/join`, { displayName: "Гостья" })
  ).json()) as { user: { displayName: string }; wsToken: string };
  assert(renamed.user.displayName === "Гостья", "введённое заново имя применилось");
  guestSock = await connect("/room", renamed.wsToken, code);
  await emitAck(guestSock, "room:hello", {});

  const setName = await emitAck<{ ok?: true; error?: string }>(guestSock, "room:set_name", {
    displayName: "Вера",
  });
  assert(setName.ok === true, "ник меняется в лобби");
  await sleep(300);
  const snap = (await emitAck(hostSock, "room:hello", {})) as RoomSnapshot;
  const everyone = [...snap.teams.flatMap((t) => t.players), ...snap.spectators];
  assert(everyone.some((p) => p.displayName === "Вера"), "новый ник виден всем");

  const guestId = joined.user.id;
  const closed = new Promise<{ reason: string }>((resolve) =>
    guestSock.once("room:closed", resolve),
  );
  const kick = await emitAck<{ ok?: true }>(hostSock, "room:kick", { userId: guestId });
  assert(kick.ok === true, "хост выгоняет игрока");
  const closedPayload = await Promise.race([closed, sleep(1500).then(() => null)]);
  assert(closedPayload?.reason === "kicked", "выгнанному приходит room:closed(kicked)");

  const blocked = await guest.post(`/api/rooms/${code}/join`, { resume: true });
  assert(blocked.status === 403, "выгнанный не может вернуться");
  const blockedText = (await blocked.json()) as { error: string };
  assert(/заблокир/i.test(blockedText.error), `в отказе сказано про блокировку: «${blockedText.error}»`);

  const unban = await emitAck<{ ok?: true }>(hostSock, "room:unban", { userId: guestId });
  assert(unban.ok === true, "хост разблокирует игрока");
  await sleep(200);
  const afterUnban = (await emitAck(hostSock, "room:hello", {})) as RoomSnapshot;
  const stillThere = [...afterUnban.teams.flatMap((t) => t.players), ...afterUnban.spectators];
  assert(
    !stillThere.some((p) => p.userId === guestId),
    "разблокировка сама никого не возвращает в комнату",
  );
  // Молча вернуться выгнанный не может и после разблокировки: из комнаты его
  // вычеркнули, участником он больше не числится. Заходит как новый — сам.
  const stillNotMember = await guest.post(`/api/rooms/${code}/join`, { resume: true });
  assert(stillNotMember.status === 400, "разблокированный не втягивается в комнату молча");
  const allowed = await guest.post(`/api/rooms/${code}/join`, { displayName: "Вера" });
  assert(allowed.status === 200, "после разблокировки он может зайти сам");

  hostSock.disconnect();
}

async function main() {
  await mafiaScenario();
  await aliasScenario();
  console.log("\n[smoke-rejoin] все проверки зелёные");
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n[smoke-rejoin] ${(e as Error).message}`);
  process.exit(1);
});
