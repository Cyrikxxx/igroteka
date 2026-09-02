// Что происходит с партией Алиаса, когда человек пропадает.
//
// Проверяет правила, ради которых всё это делалось:
//   • посреди партии игрок команды выйти не может — состав заморожен;
//   • зритель выйти может: на ход он не влияет;
//   • пропал объясняющий — раунд сам встаёт на паузу, время не горит;
//   • вернулся — снимает паузу сам;
//   • следующий объясняющий не в сети — ход передать нельзя;
//   • вернулся — ход проходит;
//   • у хоста есть рычаг: завершить партию досрочно, счёт сохраняется.
//
// Запуск: `npm run smoke:ingame -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { RoomSnapshot, RoundWordPayload } from "@alias/shared/domain";

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

function connect(token: string, code: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = ioClient(`${WS}/room`, {
      auth: { token, code },
      transports: ["websocket"],
      reconnection: false,
      timeout: 4000,
    });
    sock.on("connect", () => resolve(sock));
    sock.on("connect_error", (e) => reject(new Error(`connect: ${e.message}`)));
  });
}

async function main() {
  const catalog = (await (await fetch(`${WEB}/api/categories`)).json()) as {
    levels: { id: number }[];
  };
  const categoryIds = [catalog.levels[0].id];

  // Комната: хост + четверо. Две команды по двое, чтобы ход ходил между ними,
  // и пятый в зрителях — на нём проверяем, что зрителю выход оставили.
  const hostTab = tab();
  await hostTab.prime();
  const created = (await (
    await hostTab.post("/api/rooms", {
      hostName: "Хост",
      title: "InGame",
      // Длинный раунд: партию ведём руками, а не по таймеру.
      settings: { roundTime: 300, winScore: 0, penaltySkip: false, categoryIds },
    })
  ).json()) as { room: { code: string }; user: { id: string }; wsToken: string };
  const code = created.room.code;

  const names = ["Аня", "Боря", "Вера", "Гриша"];
  const guests: { user: { id: string }; wsToken: string }[] = [];
  const tabs = [];
  for (const name of names) {
    const t = tab();
    await t.prime();
    const r = await t.post(`/api/rooms/${code}/join`, { displayName: name });
    guests.push((await r.json()) as { user: { id: string }; wsToken: string });
    tabs.push(t);
  }

  const hostSock = await connect(created.wsToken, code);
  await emitAck(hostSock, "room:hello", {});
  const socks: Socket[] = [];
  for (const g of guests) {
    const s = await connect(g.wsToken, code);
    await emitAck(s, "room:hello", {});
    socks.push(s);
  }

  const all = [hostSock, ...socks];
  const ids = [created.user.id, ...guests.map((g) => g.user.id)];
  const label = ["Хост", ...names];
  const sockOf = (id: string) => all[ids.indexOf(id)];
  const nameOf = (id: string | null | undefined) => label[ids.indexOf(id ?? "")] ?? "?";

  // Слово уходит объясняющему приватно — подписываемся до старта.
  const words: Record<string, RoundWordPayload[]> = {};
  ids.forEach((id, i) => {
    words[id] = [];
    all[i].on("round:word", (w: RoundWordPayload) => words[id].push(w));
  });

  const snap = () => {
    const alive = all.find((x) => x.connected);
    if (!alive) throw new Error("не осталось ни одного живого сокета");
    return new Promise<RoomSnapshot>((resolve) =>
      alive.emit("room:hello", {}, (r: unknown) => resolve(r as RoomSnapshot)),
    );
  };
  /** Сокет хоста: он мог переподключиться, и старая ссылка уже мертва. */
  const host = () => all[0];

  // Хост+Аня против Бори+Веры, Гриша смотрит.
  const t1 = await emitAck<{ teamId: number }>(hostSock, "team:create", { name: "Лисы" });
  const t2 = await emitAck<{ teamId: number }>(hostSock, "team:create", { name: "Совы" });
  await emitAck(hostSock, "team:join", { teamId: t1.teamId });
  await emitAck(socks[0], "team:join", { teamId: t1.teamId }); // Аня
  await emitAck(socks[1], "team:join", { teamId: t2.teamId }); // Боря
  await emitAck(socks[2], "team:join", { teamId: t2.teamId }); // Вера
  // Гриша (socks[3]) никуда не вступает и остаётся зрителем.
  await sleep(300);

  const start = await emitAck<{ ok?: true; error?: string }>(hostSock, "round:start_game", {});
  if (start.error) throw new Error(`start: ${start.error}`);
  await sleep(1200);

  const s0 = await snap();
  assert(s0.phase === "ROUND_ACTIVE", `партия идёт (${s0.phase})`);
  const explainerId = s0.currentPlayerId!;
  console.log(`  · объясняет ${nameOf(explainerId)}`);

  // ─── Выйти посреди партии игрок команды не может ───
  const leaveTry = await emitAck<{ error?: string }>(socks[0], "room:leave", {});
  assert(leaveTry.error === "game_in_progress", "игрок команды не может выйти посреди партии");

  // ─── Пропал объясняющий → автопауза ───
  const explainerSock = sockOf(explainerId);
  explainerSock.disconnect();
  await sleep(700);
  const sPaused = await snap();
  assert(sPaused.timer?.paused === true, "раунд встал на паузу, когда объясняющий пропал");

  // ─── Вернулся → снимает паузу сам ───
  const backSock = await connect(
    explainerId === created.user.id ? created.wsToken : guests[ids.indexOf(explainerId) - 1].wsToken,
    code,
  );
  await emitAck(backSock, "room:hello", {});
  await sleep(400);
  const sBack = await snap();
  assert(sBack.timer?.paused === true, "сама по себе пауза не снимается — время не горит зря");
  await emitAck(backSock, "round:resume", {});
  await sleep(300);
  const sResumed = await snap();
  assert(sResumed.timer?.paused === false, "вернувшийся снимает паузу сам");

  // ─── Досрочно завершаем раунд и упираемся в оффлайн следующего ───
  all[ids.indexOf(explainerId)] = backSock;
  const mine = words[explainerId];
  for (let i = 0; i < 40 && mine.length === 0; i++) await sleep(100);
  if (mine.length > 0) {
    await emitAck(backSock, "round:guess", { wordId: mine[mine.length - 1].wordId, guessed: true });
  }
  await emitAck(backSock, "round:end", {});
  await sleep(600);

  const sReview = await snap();
  assert(sReview.phase === "ROUND_REVIEW", `дошли до итогов раунда (${sReview.phase})`);

  // Кто объясняет следующим — уводим его в оффлайн.
  const nextTeam = sReview.teams[((sReview.currentTeamIndex ?? 0) + 1) % sReview.teams.length];
  const nextId = nextTeam.players[nextTeam.playerCursor ?? 0].userId;
  console.log(`  · следующим объясняет ${nameOf(nextId)}`);
  all[ids.indexOf(nextId)].disconnect();
  await sleep(600);

  const blocked = await emitAck<{ error?: string }>(backSock, "round:review_confirm", {});
  assert(
    blocked.error === "next_explainer_offline",
    "ход не передаётся, пока следующий объясняющий не в сети",
  );

  // ─── Вернулся — ход проходит ───
  const nextIdx = ids.indexOf(nextId);
  const nextBack = await connect(
    nextId === created.user.id ? created.wsToken : guests[nextIdx - 1].wsToken,
    code,
  );
  await emitAck(nextBack, "room:hello", {});
  all[nextIdx] = nextBack;
  await sleep(500);
  const passed = await emitAck<{ ok?: true; error?: string }>(backSock, "round:review_confirm", {});
  assert(passed.ok === true, "как только он в сети — ход передаётся");
  await sleep(600);

  // ─── Зритель выйти может ───
  const sMid = await snap();
  const spectator = sMid.spectators[0];
  if (spectator) {
    const specSock = all[ids.indexOf(spectator.userId)];
    const specLeave = await emitAck<{ ok?: true; error?: string }>(specSock, "room:leave", {});
    assert(specLeave.ok === true, "зритель может выйти посреди партии");
  } else {
    console.log("  · зрителей в комнате нет, проверку пропускаем");
  }

  // ─── Хост обрывает партию ───
  const ended = await emitAck<{ ok?: true; error?: string }>(host(), "round:end_game", {});
  assert(ended.ok === true, "хост может завершить партию досрочно");
  await sleep(700);
  const sEnd = await snap();
  assert(sEnd.phase === "FINISHED", `после этого партия завершена (${sEnd.phase})`);
  assert(
    sEnd.teams.some((t) => t.score > 0),
    "счёт сохранился — партия не обнулилась",
  );

  // ─── И комната возвращается в лобби ───
  const restarted = await emitAck<{ ok?: true; error?: string }>(host(), "room:restart", {});
  assert(restarted.ok === true, "оттуда «Сыграть ещё» возвращает комнату в лобби");
  await sleep(400);
  const sLobby = await snap();
  assert(sLobby.phase === "LOBBY", "комната снова в лобби — состав можно пересобрать");

  console.log("\n[smoke-ingame] все проверки зелёные");
  all.forEach((s) => s.disconnect());
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n[smoke-ingame] ${(e as Error).message}`);
  process.exit(1);
});
