// Дневное голосование: порядок фаз и скип.
//
// Партия начинается со вступительного обсуждения (day 0): люди знакомятся, и
// изгонять в нём некого. Голосование наступает начиная с первого дня — раньше
// тут была настройка «первый день без голосования», из-за которой вшестером
// мафия побеждала за две ночи, а город не голосовал ни разу за партию.
//
// Проверяется:
//   1) партия открывается обсуждением, из него уходит в ночь без голосования;
//   2) в первый день голосование есть и заканчивается изгнанием;
//   3) скип: если большинство за «никого не изгонять», никто не выбывает.
//
// Запуск: `npm run smoke:vote -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { MafiaView, MafiaPhase } from "@alias/shared/mafia";

const WEB = process.env.SMOKE_WEB ?? "http://localhost:3000";
const WS = process.env.SMOKE_WS ?? "http://localhost:3001";

class Client {
  name: string;
  cookie = "";
  token = "";
  code = "";
  sock!: Socket;
  view: MafiaView | null = null;
  /** Все фазы, что видел клиент, — по ним потом судим о ходе партии. */
  seen: MafiaPhase[] = [];

  constructor(name: string) {
    this.name = name;
  }

  private async req(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${WEB}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const sc = res.headers.get("set-cookie");
    if (sc) {
      const m = sc.match(/^([^=]+)=([^;]+)/);
      if (m) this.cookie = `${m[1]}=${m[2]}`;
    }
    return res;
  }

  async primeCookie(): Promise<void> {
    await this.req("/api/categories");
  }

  async createRoom(rules?: Record<string, boolean>): Promise<void> {
    const res = await this.req("/api/mafia/rooms", {
      method: "POST",
      body: JSON.stringify({
        hostName: this.name,
        title: "Smoke голосования",
        // Таймеры укорачиваем: ждать две минуты обсуждения незачем.
        // Правила по умолчанию не трогаем — их и проверяем.
        settings: {
          roles: { don: false, sheriff: true, doctor: true, maniac: false },
          timers: { night: 12, discussion: 8, vote: 12, lastWord: 6 },
          ...(rules ? { rules } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`create room: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { room: { code: string }; wsToken: string };
    this.code = data.room.code;
    this.token = data.wsToken;
  }

  async join(code: string): Promise<void> {
    const res = await this.req(`/api/mafia/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName: this.name }),
    });
    if (!res.ok) throw new Error(`join ${this.name}: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { wsToken: string };
    this.code = code;
    this.token = data.wsToken;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sock = ioClient(`${WS}/mafia`, {
        auth: { token: this.token, code: this.code, name: this.name },
        transports: ["websocket"],
        reconnection: false,
        timeout: 5000,
      });
      const track = (v: MafiaView) => {
        this.view = v;
        if (this.seen[this.seen.length - 1] !== v.phase) this.seen.push(v.phase);
      };
      this.sock.on("mafia:state", track);
      this.sock.on("connect", () => {
        this.sock.emit("mafia:hello", {}, (ack: MafiaView | { error: string }) => {
          if ("error" in ack) return reject(new Error(`hello ${this.name}: ${ack.error}`));
          track(ack);
          resolve();
        });
      });
      this.sock.on("connect_error", (e) =>
        reject(new Error(`connect ${this.name}: ${e.message}`)),
      );
    });
  }

  emit(event: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve) => this.sock.emit(event, payload, resolve));
  }

  get role() {
    return this.view?.you.role ?? null;
  }
  get phase() {
    return this.view?.phase;
  }
  get day() {
    return this.view?.day ?? 0;
  }
  get alive() {
    return this.view?.you.alive ?? false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function assert(ok: boolean, what: string) {
  if (!ok) throw new Error(`ПРОВАЛ: ${what}`);
  console.log(`  ok · ${what}`);
}

async function waitPhase(
  cs: Client[],
  phase: MafiaPhase,
  timeoutMs = 40000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (cs.some((c) => c.phase === phase)) return;
    await sleep(100);
  }
  const trace = cs[0]!.seen.join(" → ");
  throw new Error(
    `ждали фазу ${phase}, а сейчас ${cs.map((c) => c.phase).join("/")}. Пройдено: ${trace}`,
  );
}

/** Мафия убивает первого живого не-мафию. */
async function mafiaKills(all: Client[]): Promise<string> {
  const mafia = all.find((c) => c.role === "mafia" || c.role === "don");
  if (!mafia) throw new Error("в раскладе нет мафии");
  const victim = mafia.view!.players.find(
    (p) => p.alive && p.userId !== mafia.view!.you.userId && !p.you,
  );
  if (!victim) throw new Error("некого убивать");
  await mafia.emit("mafia:night_action", { action: "mafia", targetId: victim.userId });
  return victim.displayName;
}

/** Поднимает комнату, раздаёт роли и доводит до вступительного обсуждения. */
async function startGame(
  names: string[],
  rules?: Record<string, boolean>,
): Promise<Client[]> {
  const host = new Client(names[0]!);
  const others = names.slice(1).map((n) => new Client(n));
  const all = [host, ...others];

  for (const c of all) await c.primeCookie();
  await host.createRoom(rules);
  for (const c of others) await c.join(host.code);
  for (const c of all) await c.connect();

  await host.emit("mafia:start");
  await waitPhase(all, "ROLE_REVEAL");
  for (const c of all) await c.emit("mafia:ready");
  await waitPhase(all, "DISCUSSION");
  console.log(`[create] код ${host.code}, игроков ${all.length}`);
  return all;
}

const anyDay = (all: Client[]) => Math.max(...all.map((c) => c.day));
const seenVote = (all: Client[]) => all.some((c) => c.seen.includes("VOTE"));

/** Все живые, кроме жертвы, голосуют за неё. */
async function cityVotes(all: Client[]): Promise<string> {
  const voter = all.find((c) => c.alive)!;
  const candidates = voter.view!.players.filter((p) => p.alive && !p.you);
  if (candidates.length === 0) throw new Error("не за кого голосовать");
  const target = candidates[0]!;
  const voters = all.filter(
    (c) => c.alive && c.view!.you.userId !== target.userId,
  );
  for (const c of voters) {
    const ack = (await c.emit("mafia:vote", { targetId: target.userId })) as
      | { ok: true }
      | { error: string };
    if (ack && "error" in ack) throw new Error(`голос ${c.name} отклонён: ${ack.error}`);
  }
  return target.displayName;
}

/** ── 1. Вступительное обсуждение, потом ночь, потом голосование ── */
async function openingThenVote(): Promise<void> {
  console.log("");
  console.log("── знакомство → ночь → день с голосованием ──");
  const all = await startGame(["Хост", "Аня", "Боря", "Вера", "Гена", "Дима"]);

  assert(anyDay(all) === 0, "партия открылась обсуждением до первой ночи");
  assert(!seenVote(all), "во вступительном обсуждении голосования нет");

  await waitPhase(all, "NIGHT");
  assert(anyDay(all) === 1, "после знакомства наступила первая ночь");
  const victim = await mafiaKills(all);

  await waitPhase(all, "MORNING");
  console.log(`[утро 1] погиб ${victim}`);

  await waitPhase(all, "DISCUSSION");
  await waitPhase(all, "VOTE");
  assert(anyDay(all) === 1, "голосование наступило в первый же день");

  const exiled = await cityVotes(all);
  await waitPhase(all, "VOTE_RESULT");
  const eliminated = all.map((c) => c.view?.vote?.eliminated).find(Boolean);
  assert(Boolean(eliminated), `город изгнал игрока (${exiled})`);

  await waitPhase(all, "LAST_WORD");
  assert(true, "у изгнанного есть последнее слово");

  console.log(`[фазы] ${all.find((c) => c.alive)?.seen.join(" → ")}`);
  for (const c of all) c.sock.disconnect();
}

/** ── 2. Скип: город решает никого не изгонять ── */
async function skipVote(): Promise<void> {
  console.log("");
  console.log("── голосование за «никого не изгонять» ──");
  const all = await startGame(["Хост", "Аня", "Боря", "Вера", "Гена", "Дима"]);

  await waitPhase(all, "NIGHT");
  await mafiaKills(all);
  await waitPhase(all, "MORNING");
  await waitPhase(all, "DISCUSSION");
  await waitPhase(all, "VOTE");

  // Все живые голосуют за скип.
  const voters = all.filter((c) => c.alive);
  for (const c of voters) {
    const ack = (await c.emit("mafia:vote", { targetId: "abstain" })) as
      | { ok: true }
      | { error: string };
    if (ack && "error" in ack) throw new Error(`скип ${c.name} отклонён: ${ack.error}`);
  }
  console.log(`[голосование] ${voters.length} голосов за «никого»`);

  await waitPhase(all, "VOTE_RESULT");
  const v = all.map((c) => c.view?.vote).find((x) => x?.skipped);
  assert(Boolean(v?.skipped), "итог голосования — никого не изгоняют");
  assert(
    all.every((c) => !c.view?.vote?.eliminated),
    "изгнанного нет",
  );
  assert(
    (v?.tally?.["abstain"] ?? 0) === voters.length,
    `голоса за скип видны в подсчёте (${v?.tally?.["abstain"]})`,
  );

  // Скип не отправляет на переголосование — сразу ночь.
  await waitPhase(all, "NIGHT");
  assert(anyDay(all) === 2, "после скипа сразу наступила следующая ночь");

  for (const c of all) c.sock.disconnect();
}

async function main(): Promise<void> {
  await openingThenVote();
  await skipVote();
  console.log("");
  console.log("[smoke-vote] все проверки зелёные");
}

main().catch((e) => {
  console.error("[smoke-vote] FAIL:", e);
  process.exit(1);
});
