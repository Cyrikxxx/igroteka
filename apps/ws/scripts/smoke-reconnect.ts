// Возвращение объясняющего в свой раунд (Алиас) и ход таймера фаз (Мафия).
//
// Проверяет ровно то, что сломалось у пользователя:
//   • объясняющий закрыл вкладку — раунд встал на паузу;
//   • вернулся — ему заново пришло текущее слово;
//   • нажал «Продолжить» — пауза снялась ВО ВСЕЙ комнате (снапшот разослан);
//   • после этого слова снова засчитываются;
//   • в Мафии по ходу фазы приходят тики таймера.
//
// Запуск: `npm run smoke:reconnect -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { RoomSnapshot, RoundWordPayload } from "@alias/shared/domain";
import type { MafiaView } from "@alias/shared/mafia";
import { mafiaRoomKey } from "@alias/shared/redis-keys";
import redis from "../src/redis";

const WEB = "http://localhost:3000";
const WS = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function assert(ok: boolean, what: string) {
  if (!ok) throw new Error(`ПРОВАЛ: ${what}`);
  console.log(`  ok · ${what}`);
}

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

// ─────────────────── Алиас: возврат объясняющего ───────────────────

async function aliasScenario() {
  console.log("\n[алиас — объясняющий вернулся в свой раунд]");
  const catalog = (await (await fetch(`${WEB}/api/categories`)).json()) as {
    levels: { id: number }[];
  };
  const categoryIds = [catalog.levels[0].id];

  const hostTab = tab();
  await hostTab.prime();
  const created = (await (
    await hostTab.post("/api/rooms", {
      hostName: "Хост",
      title: "Reconnect",
      settings: { roundTime: 120, winScore: 0, penaltySkip: false, categoryIds },
    })
  ).json()) as { room: { code: string }; user: { id: string }; wsToken: string };
  const code = created.room.code;

  const hostSock = await connect("/room", created.wsToken, code);
  await emitAck(hostSock, "room:hello", {});

  // Ещё трое: две команды по двое.
  const guests: { user: { id: string }; wsToken: string; sock: Socket }[] = [];
  for (const name of ["Боря", "Вера", "Гриша"]) {
    const t = tab();
    await t.prime();
    const j = (await (
      await t.post(`/api/rooms/${code}/join`, { displayName: name })
    ).json()) as { user: { id: string }; wsToken: string };
    const sock = await connect("/room", j.wsToken, code);
    await emitAck(sock, "room:hello", {});
    guests.push({ ...j, sock });
  }

  const t1 = await emitAck<{ teamId: number }>(hostSock, "team:create", { name: "Лисы" });
  const t2 = await emitAck<{ teamId: number }>(hostSock, "team:create", { name: "Совы" });
  await emitAck(hostSock, "team:join", { teamId: t1.teamId });
  await emitAck(guests[0].sock, "team:join", { teamId: t1.teamId });
  await emitAck(guests[1].sock, "team:join", { teamId: t2.teamId });
  await emitAck(guests[2].sock, "team:join", { teamId: t2.teamId });
  await sleep(300);

  // Слово уходит приватно — подписываемся до старта.
  const words: Record<string, RoundWordPayload[]> = {};
  const all = [
    { id: created.user.id, sock: hostSock },
    ...guests.map((g) => ({ id: g.user.id, sock: g.sock })),
  ];
  for (const a of all) {
    words[a.id] = [];
    a.sock.on("round:word", (w: RoundWordPayload) => words[a.id].push(w));
  }

  const start = await emitAck<{ ok?: true; error?: string }>(hostSock, "round:start_game", {});
  if (start.error) throw new Error(`start: ${start.error}`);
  await sleep(1200);

  const snapOf = (s: Socket) =>
    new Promise<RoomSnapshot>((resolve) =>
      s.emit("room:hello", {}, (r: unknown) => resolve(r as RoomSnapshot)),
    );

  let snap = await snapOf(hostSock);
  assert(snap.phase === "ROUND_ACTIVE", "раунд идёт");
  const explainerId = snap.currentPlayerId!;
  const explainer = all.find((a) => a.id === explainerId)!;
  const explainerToken =
    explainerId === created.user.id
      ? created.wsToken
      : guests.find((g) => g.user.id === explainerId)!.wsToken;
  assert(words[explainerId].length > 0, "объясняющему пришло слово");

  // Наблюдаем за комнатой с чужого сокета: объясняющим вполне может оказаться
  // сам хост, и спрашивать состояние у отключённого сокета бессмысленно.
  const observer = all.find((a) => a.id !== explainerId)!.sock;

  // Закрыл вкладку.
  explainer.sock.disconnect();
  await sleep(600);
  snap = await snapOf(observer);
  assert(snap.timer?.paused === true, "раунд встал на паузу");

  // Вернулся: новая вкладка, новый сокет.
  const backWords: RoundWordPayload[] = [];
  const back = await connect("/room", explainerToken, code);
  back.on("round:word", (w: RoundWordPayload) => backWords.push(w));
  // Клиент живёт не опросом, а рассылками: именно по ним у него пропадает
  // предупреждение и разблокируются кнопки.
  const pushedStates: RoomSnapshot[] = [];
  const pushedTicks: { msLeft: number }[] = [];
  back.on("room:state", (s: RoomSnapshot) => pushedStates.push(s));
  back.on("round:tick", (t: { msLeft: number }) => pushedTicks.push(t));
  await emitAck(back, "room:hello", {});
  await sleep(400);
  assert(backWords.length > 0, "вернувшемуся заново пришло его слово");

  // Нажал «Продолжить».
  pushedStates.length = 0;
  pushedTicks.length = 0;
  const resumed = await emitAck<{ ok?: true; error?: string }>(back, "round:resume", {});
  assert(resumed.ok === true, "«Продолжить» принято сервером");
  await sleep(1200);

  assert(pushedTicks.length > 0, "после «Продолжить» пошли тики таймера");
  // Вот это и ломалось: снятие паузы никому не рассылалось, и у клиента
  // навсегда оставалось timer.paused = true.
  assert(
    pushedStates.some((s) => s.timer?.paused === false),
    "снятие паузы разослано в комнату (не только записано в снапшот)",
  );

  // Это и ломалось: снапшот с paused=false никому не рассылался, поэтому у
  // вернувшегося оставалось предупреждение, а кнопки «угадал/пропустить»
  // считались заблокированными.
  const mine = await snapOf(back);
  assert(mine.timer?.paused === false, "у самого вернувшегося пауза снята");
  const atOthers = await snapOf(observer);
  assert(atOthers.timer?.paused === false, "пауза снята и у остальных в комнате");

  // Слова снова засчитываются.
  const before = backWords.length;
  const guess = await emitAck<{ ok?: true; error?: string }>(back, "round:guess", {
    wordId: backWords[backWords.length - 1].wordId,
    guessed: true,
  });
  assert(!guess.error, `слово засчитано без ошибки${guess.error ? ` (${guess.error})` : ""}`);
  await sleep(400);
  assert(backWords.length > before, "пришло следующее слово — раунд продолжается");

  all.forEach((a) => a.sock.disconnect());
  back.disconnect();
}

// ─────────────────── Мафия: идёт ли таймер фазы ───────────────────

async function mafiaScenario() {
  console.log("\n[мафия — таймер фазы]");
  const hostTab = tab();
  await hostTab.prime();
  const created = (await (
    await hostTab.post("/api/mafia/rooms", { hostName: "Хост", title: "Timer" })
  ).json()) as { room: { code: string }; user: { id: string }; wsToken: string };
  const code = created.room.code;

  const hostSock = await connect("/mafia", created.wsToken, code, "Хост");
  await emitAck(hostSock, "mafia:hello", {});

  const socks: Socket[] = [hostSock];
  for (const name of ["Б", "В", "Г", "Д"]) {
    const t = tab();
    await t.prime();
    const j = (await (
      await t.post(`/api/mafia/rooms/${code}/join`, { displayName: name })
    ).json()) as { wsToken: string };
    const s = await connect("/mafia", j.wsToken, code, name);
    await emitAck(s, "mafia:hello", {});
    socks.push(s);
  }

  const ticks: { msLeft: number; paused: boolean }[] = [];
  hostSock.on("mafia:tick", (p: { msLeft: number; paused: boolean }) => ticks.push(p));

  const start = await emitAck<{ ok?: true; error?: string }>(hostSock, "mafia:start", {});
  if (start.error) throw new Error(`start: ${start.error}`);

  // Все подтверждают роль → вступительное обсуждение, у него есть таймер.
  for (const s of socks) await emitAck(s, "mafia:ready", {});
  await sleep(2500);

  const view = (await emitAck(hostSock, "mafia:hello", {})) as MafiaView;
  assert(view.phase === "DISCUSSION", `фаза с таймером началась (${view.phase})`);
  assert(view.timer !== undefined, "в состоянии комнаты есть таймер");
  assert(ticks.length >= 2, `тики таймера приходят (получено ${ticks.length})`);
  const falling = ticks[ticks.length - 1].msLeft < ticks[0].msLeft;
  assert(falling, `остаток убывает (${ticks[0].msLeft} → ${ticks[ticks.length - 1].msLeft})`);

  // Все закрыли вкладки. Раньше партия продолжала играть сама с собой:
  // таймеры живут в процессе сервера, фазы сменялись без единого участника,
  // и каждая смена продлевала комнате жизнь — так до бесконечности.
  const hostToken = created.wsToken;
  socks.forEach((s) => s.disconnect());
  await sleep(900);

  // Состояние читаем прямо из Redis: ответ на mafia:hello собирается уже
  // после того, как вернувшийся снимает эту паузу, и по нему её не увидеть.
  const raw = await redis.get(mafiaRoomKey(code));
  const stored = JSON.parse(raw ?? "{}") as {
    phase?: string;
    timerPaused?: boolean;
    pausedByEmpty?: boolean;
  };
  assert(stored.timerPaused === true, "партия встала, когда комната опустела");
  assert(stored.pausedByEmpty === true, "и помечена именно как «пауза из-за пустой комнаты»");
  assert(stored.phase === "DISCUSSION", `фаза осталась прежней (${stored.phase})`);

  const peek = await connect("/mafia", hostToken, code, "Хост");
  await emitAck(peek, "mafia:hello", {});

  // Первый вернувшийся снимает эту паузу сам — и время идёт с того же места.
  const resumeTicks: { msLeft: number }[] = [];
  peek.on("mafia:tick", (p: { msLeft: number }) => resumeTicks.push(p));
  await sleep(1600);
  assert(resumeTicks.length > 0, "с возвращением игрока партия продолжилась");

  peek.disconnect();
}

async function main() {
  await aliasScenario();
  await mafiaScenario();
  console.log("\n[smoke-reconnect] все проверки зелёные");
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n[smoke-reconnect] ${(e as Error).message}`);
  process.exit(1);
});
