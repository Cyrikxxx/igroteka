// End-to-end smoke партии Мафии на шести клиентах: создать комнату, войти
// пятерым, раздать роли, отыграть ночь (мафия/шериф/доктор), утро,
// обсуждение, голосование, последнее слово — и убедиться, что машина
// состояний доехала до следующей ночи.
//
// Заменяет ручной прогон в шести вкладках.
// Запуск: `npm run smoke:mafia -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { MafiaView, MafiaPhase } from "@alias/shared/mafia";

// По умолчанию бьём в dev-серверы. Чтобы проверить прод-сборку за прокси,
// где web и ws на одном адресе:
//   SMOKE_WEB=http://localhost SMOKE_WS=http://localhost npm run smoke:mafia -w @alias/ws
const WEB = process.env.SMOKE_WEB ?? "http://localhost:3000";
const WS =
  process.env.SMOKE_WS ?? process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";
const NAMES = ["Хост", "Кира", "Стас", "Маша", "Пётр", "Лена"];

/** Отдельная «банка» cookie на каждого игрока — иначе все будут одним userId. */
class Client {
  name: string;
  cookie = "";
  token = "";
  code = "";
  sock!: Socket;
  view: MafiaView | null = null;

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

  async createRoom(): Promise<void> {
    const res = await this.req("/api/mafia/rooms", {
      method: "POST",
      body: JSON.stringify({
        hostName: this.name,
        title: "Smoke",
        settings: {
          roles: { don: true, sheriff: true, doctor: true, maniac: false },
          // Минимально допустимые таймеры — чтобы скрипт не шёл минутами.
          timers: { night: 15, discussion: 30, vote: 15, lastWord: 10 },
          // Иначе первый день пропускает голосование и мы его не проверим.
          rules: { firstDayNoVote: false },
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
      this.sock.on("mafia:state", (v: MafiaView) => (this.view = v));
      this.sock.on("connect", () => {
        this.sock.emit("mafia:hello", {}, (ack: MafiaView | { error: string }) => {
          if ("error" in ack) return reject(new Error(`hello ${this.name}: ${ack.error}`));
          this.view = ack;
          resolve();
        });
      });
      this.sock.on("connect_error", (e) => reject(new Error(`connect ${this.name}: ${e.message}`)));
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
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ждём, пока хост увидит нужную фазу. Иначе падаем с внятным сообщением. */
async function waitPhase(c: Client, phase: MafiaPhase, timeoutMs = 25000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (c.phase === phase) return;
    await sleep(200);
  }
  throw new Error(`ждали фазу ${phase}, а сейчас ${c.phase}`);
}

async function main(): Promise<void> {
  const clients = NAMES.map((n) => new Client(n));
  for (const c of clients) await c.primeCookie();

  const [host, ...rest] = clients;
  await host.createRoom();
  console.log(`[create] code=${host.code}`);
  for (const c of rest) await c.join(host.code);
  console.log(`[join] ${rest.length} игроков вошли`);

  for (const c of clients) await c.connect();
  console.log(`[ws] подключены: ${host.view?.players.length} в лобби`);

  await host.emit("mafia:start");
  await waitPhase(host, "ROLE_REVEAL");
  console.log("[start] роли розданы");

  for (const c of clients) await c.emit("mafia:ready");
  await waitPhase(host, "NIGHT");
  const roles = clients.map((c) => `${c.name}:${c.role}`).join(" ");
  console.log(`[night 1] ${roles}`);

  // ─── Пауза посреди ночи ───
  await host.emit("mafia:pause");
  await sleep(300);
  if (!host.view?.timer?.paused) throw new Error("пауза не включилась");
  const frozen = host.view.timer.msLeft;
  await sleep(1500);
  if (host.view?.timer?.msLeft !== frozen) {
    throw new Error("таймер продолжил идти на паузе");
  }
  await host.emit("mafia:resume");
  await sleep(300);
  if (host.view?.timer?.paused) throw new Error("пауза не снялась");
  console.log(`[pause] таймер замер на ${Math.round(frozen / 1000)}с и пошёл дальше`);

  // ─── Ночные ходы ───
  const mafias = clients.filter((c) => c.role === "mafia" || c.role === "don");
  const sheriff = clients.find((c) => c.role === "sheriff");
  const doctor = clients.find((c) => c.role === "doctor");
  const victim = clients.find((c) => c.role === "civilian");
  if (!victim) throw new Error("в раскладе нет мирного — проверь состав");

  for (const m of mafias) {
    await m.emit("mafia:night_action", { action: "mafia", targetId: victimId(victim) });
  }
  if (sheriff) {
    const target = mafias[0];
    await sheriff.emit("mafia:night_action", { action: "sheriff", targetId: victimId(target) });
  }
  if (doctor) {
    // Лечим не жертву — иначе ночь пройдёт без смертей и утро будет пустым.
    const self = victimId(doctor);
    await doctor.emit("mafia:night_action", { action: "doctor", targetId: self });
  }

  await waitPhase(host, "MORNING");
  const killed = host.view?.spotlight?.displayName;
  console.log(`[morning] погиб: ${killed ?? "никто"}`);
  if (killed !== victim.name) throw new Error(`ожидали смерть ${victim.name}, получили ${killed}`);

  if (sheriff) {
    const known = sheriff.view?.you.sheriffResults ?? {};
    console.log(`[sheriff] проверка: ${JSON.stringify(known)}`);
    if (Object.values(known)[0] !== true) throw new Error("шериф не увидел мафию");
  }

  // ─── День ───
  await waitPhase(host, "DISCUSSION");
  console.log("[discussion] хост завершает досрочно");
  await host.emit("mafia:end_discussion");

  await waitPhase(host, "VOTE");
  const alive = clients.filter((c) => c.view?.you.alive);
  const suspect = mafias[0];
  for (const c of alive) {
    if (c === suspect) continue;
    await c.emit("mafia:vote", { targetId: victimId(suspect) });
  }
  await waitPhase(host, "VOTE_RESULT");
  console.log(`[vote] изгоняют: ${host.view?.spotlight?.displayName}`);

  await waitPhase(host, "LAST_WORD");
  await suspect.emit("mafia:last_word_done");

  // Партия либо пошла в следующую ночь, либо сразу закончилась победой.
  const started = Date.now();
  while (Date.now() - started < 25000) {
    if (host.phase === "NIGHT" || host.phase === "FINISHED") break;
    await sleep(200);
  }
  console.log(`[after last word] фаза: ${host.phase}, победитель: ${host.view?.winner ?? "—"}`);
  if (host.phase !== "NIGHT" && host.phase !== "FINISHED") {
    throw new Error(`партия зависла в фазе ${host.phase}`);
  }

  for (const c of clients) c.sock.disconnect();
  console.log("[ok] smoke-mafia passed");
}

/** userId клиента виден в его же view. */
function victimId(c: Client): string {
  const id = c.view?.you.userId;
  if (!id) throw new Error(`нет userId у ${c.name}`);
  return id;
}

main().catch((e) => {
  console.error("[smoke-mafia] FAIL:", e);
  process.exit(1);
});
