// Онлайн-круг игры втроём: три реальных сокет-клиента проходят все шесть
// ходов комнаты в формате TRIO.
//
// Смысл сценария — не «партия запустилась», а то, что на каждом ходу роли
// расставлены верно: объясняющий и угадывающий разные люди, третий вообще не
// в паре, очки приходят обоим, и за круг каждый успевает рассказать каждому и
// поугадывать у каждого.
//
// Запуск: `npm run smoke:trio-online -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { RoomSnapshot, RoundWordPayload } from "@alias/shared/domain";
import { TRIO_TURNS } from "@alias/shared/trio";

const WEB = "http://localhost:3000";
const WS = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";
const NAMES = ["Аня", "Боря", "Вера"];
const GUESSED_PER_TURN = [3, 5, 2, 4, 6, 1];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    header: () => [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}

function emitAck<T>(sock: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => sock.emit(event, payload, resolve as (r: T) => void));
}

function connectWS(wsToken: string, code: string, label: string): Promise<Socket> {
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
          reject(new Error(`[${label}] hello: ${JSON.stringify(resp)}`));
          return;
        }
        resolve(sock);
      });
    });
    sock.on("connect_error", (err) => reject(new Error(`[${label}] connect: ${err.message}`)));
  });
}

function assert(ok: boolean, what: string) {
  if (!ok) throw new Error(`ПРОВАЛ: ${what}`);
  console.log(`  ok · ${what}`);
}

async function main() {
  const catRes = await fetch(`${WEB}/api/categories`);
  const catalog = (await catRes.json()) as {
    levels: { id: number; slug: string }[];
    collections: { categories: { id: number; slug: string }[] }[];
  };
  const all = [...catalog.levels, ...catalog.collections.flatMap((c) => c.categories)];
  const categoryIds = ["animals", "food"].map((s) => all.find((c) => c.slug === s)!.id);

  // Комната. winScore = 0, чтобы партия не оборвалась раньше конца круга.
  const hostJar = jar();
  hostJar.read(await fetch(`${WEB}/api/categories`));
  const r1 = await fetch(`${WEB}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: hostJar.header() },
    body: JSON.stringify({
      hostName: NAMES[0],
      title: "SmokeTrio",
      settings: { roundTime: 60, winScore: 0, penaltySkip: false, categoryIds },
    }),
  });
  if (!r1.ok) throw new Error(`create: ${r1.status}`);
  const created = (await r1.json()) as {
    room: { code: string };
    user: { id: string };
    wsToken: string;
  };
  console.log(`[smoke-trio-online] комната ${created.room.code}`);

  const joined: { user: { id: string; displayName: string }; wsToken: string }[] = [];
  for (const name of NAMES.slice(1)) {
    const j = jar();
    j.read(await fetch(`${WEB}/api/categories`));
    const r = await fetch(`${WEB}/api/rooms/${created.room.code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: j.header() },
      body: JSON.stringify({ displayName: name }),
    });
    if (!r.ok) throw new Error(`join ${name}: ${r.status}`);
    joined.push(await r.json());
  }

  const socks: Socket[] = [await connectWS(created.wsToken, created.room.code, NAMES[0])];
  for (let i = 0; i < joined.length; i++) {
    socks.push(await connectWS(joined[i].wsToken, created.room.code, NAMES[i + 1]));
  }
  const userIds = [created.user.id, ...joined.map((j) => j.user.id)];
  const nameOf = (id: string | null | undefined) => {
    const i = userIds.indexOf(id ?? "");
    return i < 0 ? "?" : NAMES[i];
  };
  const sockOf = (id: string) => socks[userIds.indexOf(id)];

  // Слово уходит объясняющему приватно — подписываемся до старта.
  const words: Record<string, RoundWordPayload[]> = {};
  userIds.forEach((id, i) => {
    words[id] = [];
    socks[i].on("round:word", (w: RoundWordPayload) => words[id].push(w));
  });

  const snap = () =>
    new Promise<RoomSnapshot>((resolve) =>
      socks[0].emit("room:hello", {}, (r: unknown) => resolve(r as RoomSnapshot)),
    );

  const fmt = await emitAck<{ ok: true } | { error: string }>(socks[0], "room:format", {
    format: "TRIO",
  });
  if ("error" in fmt) throw new Error(`room:format: ${fmt.error}`);
  const s0 = await snap();
  assert(s0.format === "TRIO", "комната переключилась в формат «втроём»");
  assert(s0.teams.length === 3, "в лобби ровно три места");

  for (let i = 0; i < 3; i++) {
    await emitAck(socks[i], "team:join", { teamId: s0.teams[i].id });
  }
  const locked = await emitAck<{ error?: string }>(socks[0], "team:create", { name: "Лишняя" });
  assert(locked.error === "trio_locked", "свою команду втроём завести нельзя");

  await sleep(300);
  const ready = await snap();
  assert(
    ready.teams.every((t) => t.players.length === 1),
    "на каждом месте ровно один человек",
  );

  const start = await emitAck<{ ok: true } | { error: string }>(socks[0], "round:start_game", {});
  if ("error" in start) throw new Error(`start: ${JSON.stringify(start)}`);

  const played: { explainer: string; guesser: string; earned: number }[] = [];
  for (let turn = 0; turn < TRIO_TURNS; turn++) {
    await sleep(900);
    const s = await snap();
    assert(s.trioTurn === turn, `ход ${turn + 1}: счётчик круга = ${turn}`);

    const explainerId = s.currentPlayerId!;
    const guesserId = s.currentGuesserId!;
    const restingId = userIds.find((id) => id !== explainerId && id !== guesserId);
    assert(explainerId !== guesserId, `ход ${turn + 1}: объясняет и угадывает — разные люди`);
    assert(
      s.teams.find((t) => t.id === s.currentTeamId)?.players[0]?.userId === explainerId,
      `ход ${turn + 1}: активное место — место объясняющего`,
    );
    assert(restingId !== undefined, `ход ${turn + 1}: ${nameOf(restingId)} вне пары`);

    const explainerSock = sockOf(explainerId);
    const mine = words[explainerId];
    const want = GUESSED_PER_TURN[turn];
    let done = 0;
    for (let attempt = 0; attempt < 80 && done < want; attempt++) {
      const w = mine[mine.length - 1];
      if (!w) {
        await sleep(120);
        continue;
      }
      await emitAck(explainerSock, "round:guess", { wordId: w.wordId, guessed: true });
      done++;
      await sleep(90);
    }
    assert(done === want, `ход ${turn + 1}: угадано ${want} слов`);

    await emitAck(explainerSock, "round:end", {});
    await sleep(400);
    const confirm = await emitAck<{ ok: true } | { error: string }>(
      explainerSock,
      "round:review_confirm",
      {},
    );
    if ("error" in confirm) throw new Error(`ход ${turn + 1}: confirm ${confirm.error}`);

    played.push({ explainer: nameOf(explainerId), guesser: nameOf(guesserId), earned: want });
    // BETWEEN_ROUNDS держится 4 секунды, потом сервер сам заводит новый раунд.
    await sleep(5200);
  }

  console.log("\n  круг:");
  played.forEach((p, i) => {
    console.log(`   ход ${i + 1}: ${p.explainer} → ${p.guesser} (+${p.earned} обоим)`);
  });
  console.log("");

  const pairs = played.map((p) => `${p.explainer}->${p.guesser}`);
  assert(new Set(pairs).size === TRIO_TURNS, "все шесть пар «кто кому» встретились ровно по разу");
  for (const name of NAMES) {
    const told = played.filter((p) => p.explainer === name).map((p) => p.guesser).sort();
    const heard = played.filter((p) => p.guesser === name).map((p) => p.explainer).sort();
    const others = NAMES.filter((n) => n !== name).sort();
    assert(JSON.stringify(told) === JSON.stringify(others), `${name} рассказал обоим`);
    assert(JSON.stringify(heard) === JSON.stringify(others), `${name} поугадывал у обоих`);
  }

  const final = await snap();
  for (const name of NAMES) {
    const expected = played
      .filter((p) => p.explainer === name || p.guesser === name)
      .reduce((sum, p) => sum + p.earned, 0);
    const team = final.teams.find((t) => nameOf(t.players[0]?.userId) === name)!;
    assert(team.score === expected, `${name}: счёт ${team.score} = сумма своих четырёх ходов (${expected})`);
  }
  assert(final.trioTurn === 0, "после шестого хода круг замкнулся");
  assert(final.currentRoundNumber === 2, "номер круга вырос только один раз");

  console.log("\n[smoke-trio-online] круг пройден целиком, все проверки зелёные");
  socks.forEach((s) => s.disconnect());
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n[smoke-trio-online] ${(e as Error).message}`);
  process.exit(1);
});
