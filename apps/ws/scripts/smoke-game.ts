// End-to-end smoke полного онлайн-цикла: создать комнату, добавить 2 команды
// с 2 игроками каждая, начать игру, пройти первый раунд (PRE_ROUND →
// ROUND_ACTIVE → один guess → ROUND_REVIEW → review_confirm → BETWEEN_ROUNDS).
//
// Запуск: `npm run smoke:game -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import { roomKey } from "@alias/shared/redis-keys";
import { redis } from "../src/redis";
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
  const body = (await r.json()) as {
    user: { id: string; displayName: string };
    wsToken: string;
  };
  // Куку возвращаем наружу: под ней потом проверяется история этого игрока.
  return { ...body, jar: j };
}

/**
 * Id категорий по slug. Раньше скрипты писали categoryIds: [1, 2] — после
 * пересборки каталога id другие, и партия оставалась вовсе без слов.
 */
async function categoryIdsBySlug(...slugs: string[]): Promise<number[]> {
  const res = await fetch(`${WEB}/api/categories`);
  if (!res.ok) throw new Error(`categories: ${res.status}`);
  const catalog = (await res.json()) as {
    levels: { id: number; slug: string }[];
    collections: { categories: { id: number; slug: string }[] }[];
  };
  const all = [...catalog.levels, ...catalog.collections.flatMap((c) => c.categories)];
  return slugs.map((slug) => {
    const found = all.find((c) => c.slug === slug);
    if (!found) throw new Error(`нет категории «${slug}»`);
    return found.id;
  });
}

async function main() {
  const categoryIds = await categoryIdsBySlug("animals", "food");
  // 1. Host создаёт комнату
  const hostJar = jar();
  await primeCookie(hostJar);
  const r1 = await fetch(`${WEB}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: hostJar.header() },
    body: JSON.stringify({
      hostName: "Host",
      title: "SmokeGame",
      settings: { roundTime: 10, winScore: 1, penaltySkip: false, categoryIds },
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

  // 8. Ждём переход PRE_ROUND → ROUND_ACTIVE (сервер ставит его сам)
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

    // Пришедший в комнату уже на итогах раунда обязан их получить. Раньше
    // `round:review` уходил ровно один раз, в момент входа в фазу, и всякий,
    // кто подключился позже (перезагрузил вкладку, вернулся из Истории),
    // навсегда застревал на экране «Подсчитываем итоги…».
    const lateReview = await new Promise<RoundReviewPayload | null>((resolve) => {
      const late = ioClient(`${WS}/room`, {
        auth: { token: created.wsToken, code: created.room.code, name: "late" },
        transports: ["websocket"],
        reconnection: false,
      });
      const done = setTimeout(() => {
        late.disconnect();
        resolve(null);
      }, 3000);
      late.on("round:review", (r: RoundReviewPayload) => {
        clearTimeout(done);
        late.disconnect();
        resolve(r);
      });
      late.on("connect", () => late.emit("room:hello", {}, () => {}));
    });
    if (!lateReview) {
      throw new Error("подключившийся на итогах раунда не получил round:review");
    }
    console.log(`[late review] слов: ${lateReview.words.length} — итоги догнали пришедшего`);

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

  // 12a. Победа считается только в конце круга команд (checkWinner срабатывает
  //      при nextTeamIndex === 0), поэтому доигрываем раунд второй команды.
  //      Её раунд стартует сам через 4 с после BETWEEN_ROUNDS.
  const snapshotNow = () =>
    new Promise<RoomSnapshot>((resolve) =>
      host.sock.emit("room:hello", {}, (r: unknown) => resolve(r as RoomSnapshot)),
    );
  const waitPhase = async (want: string, ms = 12000) => {
    const until = Date.now() + ms;
    for (;;) {
      const snap = await snapshotNow();
      if (snap.phase === want) return snap;
      if (Date.now() > until) throw new Error(`ждал ${want}, застряли на ${snap.phase}`);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const socketOf = (userId: string): Socket => {
    if (userId === created.user.id) return host.sock;
    const i = players.findIndex((p) => p.user.id === userId);
    if (i < 0) throw new Error(`нет сокета для ${userId}`);
    return pSockets[i];
  };

  const active = await waitPhase("ROUND_ACTIVE");
  // Хост завершает раунд досрочно — доигрывать его до таймера смысла нет.
  await emitAck<{ ok: true } | { error: string }>(host.sock, "round:end", { confirm: true });
  await waitPhase("ROUND_REVIEW");
  // Подтвердить итоги может только объясняющий — у хоста прав на это нет.
  const confirm2 = await emitAck<{ ok: true } | { error: string }>(
    socketOf(active.currentPlayerId!),
    "round:review_confirm",
    {},
  );
  if (!("ok" in confirm2)) throw new Error(`review_confirm → ${JSON.stringify(confirm2)}`);
  await waitPhase("FINISHED");
  console.log("[finish] круг команд доигран, партия завершена");

  // 12b. Партия доиграна — «сыграть ещё» должно вернуть комнату в лобби
  //      тем же составом и снова открыть её для входа по коду.
  const finished = await snapshotNow();
  const rosterBefore = finished.teams.map((t) => t.players.length).join(",");

  // 12a. История: доигранную онлайн-партию видит не только хост.
  //      Раньше список строился по ownerKey — и пятеро из шести не находили
  //      в истории партию, в которой только что играли.
  const gameId = finished.gameId;
  if (!gameId) throw new Error("у доигранной партии нет gameId");
  const guest = players[0];
  const guestHeaders = { cookie: guest.jar.header() };

  const guestGames = (await (
    await fetch(`${WEB}/api/games`, { headers: guestHeaders })
  ).json()) as { id: string; mine?: boolean }[];
  const seen = guestGames.find((g) => g.id === gameId);
  if (!seen) throw new Error("гость не видит партию, в которой играл");
  if (seen.mine !== false) throw new Error("гостю отдали право удалять чужую партию");

  // Плитки считают по тому же отбору, что и список: иначе «сыграно партий»
  // спорило бы с длиной списка на одном экране.
  const guestStats = (await (
    await fetch(`${WEB}/api/stats`, { headers: guestHeaders })
  ).json()) as { games: number; guessedWords: number };
  if (guestStats.games < 1) throw new Error("плитка не увидела партию гостя");

  // 12b. «Убрать из своей истории»: онлайн-партию видят все участники, поэтому
  //      кнопка прячет карточку только у нажавшего. Стереть её у остальных не
  //      может никто — в том числе хост.
  const hideRes = await fetch(`${WEB}/api/games/${gameId}`, {
    method: "DELETE",
    headers: guestHeaders,
  });
  if (hideRes.status !== 204) {
    throw new Error(`гость не смог убрать партию у себя: ${hideRes.status}`);
  }

  const guestList = (await (
    await fetch(`${WEB}/api/games`, { headers: guestHeaders })
  ).json()) as { id: string }[];
  if (guestList.some((g) => g.id === gameId)) {
    throw new Error("убранная партия осталась в истории гостя");
  }

  const hostList = (await (
    await fetch(`${WEB}/api/games`, { headers: { cookie: hostJar.header() } })
  ).json()) as { id: string }[];
  if (!hostList.some((g) => g.id === gameId)) {
    throw new Error("партия пропала и у хоста — убирали только у гостя");
  }

  const guestStatsAfter = (await (
    await fetch(`${WEB}/api/stats`, { headers: guestHeaders })
  ).json()) as { games: number };
  if (guestStatsAfter.games !== guestStats.games - 1) {
    throw new Error("плитка не заметила, что партию убрали");
  }
  console.log(
    `[history] гость видит партию и убирает её только у себя; плитки: ${guestStats.games} → ${guestStatsAfter.games}`,
  );

  const restart = await emitAck<{ ok: true } | { error: string }>(
    host.sock,
    "room:restart",
    {},
  );
  if (!("ok" in restart)) throw new Error(`room:restart → ${JSON.stringify(restart)}`);
  await new Promise((r) => setTimeout(r, 250));

  const back = await snapshotNow();
  if (back.phase !== "LOBBY") throw new Error(`после рестарта фаза ${back.phase}`);
  if (back.teams.some((t) => t.score !== 0)) throw new Error("счёт не обнулился");
  if (back.gameId !== null) throw new Error("gameId не сброшен");
  if (back.teams.map((t) => t.players.length).join(",") !== rosterBefore) {
    throw new Error("состав команд не сохранился");
  }

  // Комнату при финале пометили FINISHED — reopenRoom обязан её открыть,
  // иначе позвать нового человека по коду уже не выйдет.
  const newcomer = jar();
  await primeCookie(newcomer);
  const rejoin = await fetch(`${WEB}/api/rooms/${created.room.code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: newcomer.header() },
    body: JSON.stringify({ displayName: "Опоздавший" }),
  });
  if (!rejoin.ok) throw new Error(`комната не открылась заново: ${rejoin.status}`);
  console.log(`[restart] LOBBY, счёт 0, состав ${rosterBefore}, вход по коду → ${rejoin.status}`);

  // 14. Брошенная партия: живое состояние протухло, а строка осталась.
  //     Комната сейчас снова в лобби тем же составом — начинаем вторую
  //     партию и стираем снимок из Redis, как это делает TTL через десять
  //     минут в комнате, где никого не осталось.
  const second = await emitAck<{ ok: true } | { error: string }>(
    host.sock,
    "round:start_game",
    {},
  );
  if (!("ok" in second)) throw new Error(`вторая партия не началась: ${JSON.stringify(second)}`);
  await new Promise((r) => setTimeout(r, 400));
  const live = await snapshotNow();
  if (!live.gameId) throw new Error("у второй партии нет gameId");
  const abandonedId = live.gameId;

  await redis.del(roomKey(created.room.code));

  // История обязана заметить это сама: доигрывать нечего — ни очереди слов,
  // ни чьего хода в Redis больше нет.
  const afterDrop = (await (
    await fetch(`${WEB}/api/games`, { headers: { cookie: hostJar.header() } })
  ).json()) as { id: string; status: string }[];
  const abandoned = afterDrop.find((g) => g.id === abandonedId);
  if (!abandoned) throw new Error("брошенная партия пропала из истории");
  if (abandoned.status !== "FINISHED") {
    throw new Error(`брошенная партия всё ещё ${abandoned.status} — карточка снова позовёт «продолжить»`);
  }

  // И код больше не пускает: комната закрыта вместе с партией.
  const stranger = jar();
  await primeCookie(stranger);
  const zombie = await fetch(`${WEB}/api/rooms/${created.room.code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: stranger.header() },
    body: JSON.stringify({ displayName: "Поздний" }),
  });
  if (zombie.status !== 410) throw new Error(`зомби-комната пустила с ${zombie.status}`);
  console.log("[abandoned] партия без живого состояния закрыта, код освобождён");

  // 13. Cleanup: закрываем
  host.sock.disconnect();
  pSockets.forEach((s) => s.disconnect());
  await fetch(`${WEB}/api/rooms/${created.room.code}`, {
    method: "DELETE",
    headers: { cookie: hostJar.header() },
  });
  await redis.quit().catch(() => {});
  console.log("[ok] smoke-game done");
  process.exit(0);
}

main().catch((e) => {
  console.error("[smoke-game] FAIL:", e);
  process.exit(1);
});
