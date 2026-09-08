// Итоги партии Мафии и «убрать из своей истории».
//
// Проверяет то, что руками проверяется долго и криво: кто видит итоги,
// кто их не видит, и что убранная партия исчезает ровно у одного человека,
// а у остальных остаётся. Плюс — что в одной комнате может лежать больше
// одной партии: раньше вторая молча не сохранялась вовсе.
//
// Партии создаются прямо в базе: доигрывать Мафию до победы скриптом долго и
// недетерминированно, а проверяем мы здесь историю, а не движок.
//
// Запуск: `npm run smoke:history -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { prisma } from "../src/prisma";

const WEB = process.env.SMOKE_WEB ?? "http://localhost:3000";

function assert(ok: boolean, what: string) {
  if (!ok) throw new Error(`ПРОВАЛ: ${what}`);
  console.log(`  ok · ${what}`);
}

/**
 * Вкладка со своей кукой. Кука подписана — `<uuid>.<подпись>`, — а userId это
 * часть до точки: ровно её сервер и достаёт из куки.
 */
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
    userId: () => (jar.get("aid") ?? "").split(".")[0] ?? "",
    cookie,
    async prime() {
      read(await fetch(`${WEB}/api/categories`));
    },
    async get(path: string) {
      const res = await fetch(`${WEB}${path}`, { headers: { cookie: cookie() } });
      read(res);
      return res;
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
    async del(path: string) {
      const res = await fetch(`${WEB}${path}`, {
        method: "DELETE",
        headers: { cookie: cookie() },
      });
      read(res);
      return res;
    },
  };
}

type Tab = ReturnType<typeof tab>;

interface HistoryRow {
  id: string;
  status: "live" | "done";
}

async function historyIds(t: Tab): Promise<string[]> {
  const res = await t.get("/api/mafia/history");
  const rows = (await res.json()) as HistoryRow[];
  return rows.map((r) => r.id);
}

/** Готовая доигранная партия в базе — как её пишет persistFinishedGame. */
async function makeGame(roomId: string, host: Tab, mate: Tab, day: number) {
  return prisma.mafiaGame.create({
    data: {
      roomId,
      hostId: host.userId(),
      status: "FINISHED",
      winner: "MAFIA",
      settings: { narrator: false, mafiaCount: "auto" },
      events: [
        { day: 1, kind: "night_fell" },
        { day: 1, kind: "kill", displayName: "Кира", role: "civilian", cause: "mafia" },
      ],
      dayCount: day,
      startedAt: new Date(),
      endedAt: new Date(),
      players: {
        create: [
          { userId: host.userId(), name: "Хост", role: "mafia", alive: true, order: 0 },
          {
            userId: mate.userId(),
            name: "Кира",
            role: "civilian",
            alive: false,
            eliminatedBy: "mafia",
            deathDay: 1,
            order: 1,
          },
        ],
      },
    },
    select: { id: true },
  });
}

async function main(): Promise<void> {
  const host = tab();
  const mate = tab();
  const stranger = tab();
  for (const t of [host, mate, stranger]) await t.prime();

  // Комната нужна настоящая: партии к ней привязаны.
  const created = await host.post("/api/mafia/rooms", {
    hostName: "Хост",
    title: "Smoke истории",
  });
  if (!created.ok) throw new Error(`комната не создалась: ${created.status}`);
  const { room } = (await created.json()) as { room: { code: string } };
  const roomRow = await prisma.room.findUnique({
    where: { code: room.code },
    select: { id: true },
  });
  if (!roomRow) throw new Error("комната не нашлась в базе");

  // ─── Две партии в одной комнате ───
  // Раньше на второй падал уникальный roomId, и она не доезжала до истории.
  const first = await makeGame(roomRow.id, host, mate, 2);
  const second = await makeGame(roomRow.id, host, mate, 4);
  assert(first.id !== second.id, "в одной комнате сохранились две партии подряд");

  const hostSees = await historyIds(host);
  assert(
    hostSees.includes(first.id) && hostSees.includes(second.id),
    "обе партии видны в истории",
  );

  // ─── Итоги ───
  const resultRes = await mate.get(`/api/mafia/games/${second.id}`);
  assert(resultRes.ok, `участник открывает итоги (${resultRes.status})`);
  const result = (await resultRes.json()) as {
    winner: string;
    players: { name: string; role: string; you: boolean }[];
    events: unknown[];
    settings: unknown;
  };
  assert(result.winner === "MAFIA", "видно, кто победил");
  assert(
    result.players.some((p) => p.name === "Хост" && p.role === "mafia"),
    "роли раскрыты — партия доиграна",
  );
  assert(
    result.players.find((p) => p.you)?.name === "Кира",
    "своя строка в составе отмечена",
  );
  assert(result.events.length > 0, "хроника на месте");
  assert(Boolean(result.settings), "правила на месте — есть из чего «сыграть так же»");

  const strangerRes = await stranger.get(`/api/mafia/games/${second.id}`);
  assert(strangerRes.status === 403, "чужие итоги закрыты");

  // ─── Убрать у себя ───
  const hidden = await mate.del(`/api/mafia/games/${second.id}`);
  assert(hidden.status === 204, "участник убирает партию из своей истории");
  const again = await mate.del(`/api/mafia/games/${second.id}`);
  assert(again.status === 204, "повторное нажатие не ломается");

  const mateAfter = await historyIds(mate);
  assert(!mateAfter.includes(second.id), "у него партия пропала");
  assert(mateAfter.includes(first.id), "а другая партия осталась");

  const hostAfter = await historyIds(host);
  assert(hostAfter.includes(second.id), "у остальных партия на месте");

  // Итоги при этом остаются доступны по прямой ссылке: карточку убрали, а не
  // саму партию.
  const stillOpen = await mate.get(`/api/mafia/games/${second.id}`);
  assert(stillOpen.ok, "по ссылке итоги всё ещё открываются");

  const stats = (await (await mate.get("/api/stats")).json()) as { mafiaGames: number };
  assert(stats.mafiaGames === 1, `плитка считает без убранной (${stats.mafiaGames})`);

  // ─── Уборка ───
  await prisma.mafiaGame.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  await prisma.room.delete({ where: { id: roomRow.id } }).catch(() => {});
  await prisma.$disconnect();
  console.log("[smoke-history] все проверки зелёные");
}

main().catch(async (e) => {
  console.error("[smoke-history] FAIL:", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
