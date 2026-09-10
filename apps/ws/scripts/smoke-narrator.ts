// Smoke режима ведущего: ночь по шагам и реплики.
//
// Проверяет то, что руками ловится хуже всего: порядок шагов, отказ ходить
// не в своё окно, скрытый от зала таймер и — главное — что шаг мёртвой роли
// всё равно случается. Если он исчезнет, стол будет узнавать о смерти
// доктора раньше, чем о ней объявят.
//
// Запуск: `npm run smoke:narrator -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { MafiaView, MafiaPhase } from "@alias/shared/mafia";

const WEB = process.env.SMOKE_WEB ?? "http://localhost:3000";
const WS =
  process.env.SMOKE_WS ?? process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";
const NAMES = ["Хост", "Кира", "Стас", "Маша", "Пётр", "Лена"];

class Client {
  name: string;
  cookie = "";
  token = "";
  code = "";
  sock!: Socket;
  view: MafiaView | null = null;
  /** Порядок шагов ночи, как его видел этот клиент. */
  steps: string[] = [];
  /** Реплики ведущего: ключ → текст. */
  said: string[] = [];

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
        title: "Smoke ведущего",
        settings: {
          narrator: true,
          roles: { don: true, sheriff: true, doctor: true, maniac: false },
          // Шаг ночи по нижней границе — иначе смок идёт минутами.
          timers: { nightStep: 8, discussion: 30, vote: 15, lastWord: 10 },
          // Первый день без голосования: нам нужна вторая ночь, а не суд.
          rules: { firstDayNoVote: true },
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

  private absorb(v: MafiaView): void {
    this.view = v;
    const step = v.night ? `${v.day}:${v.night.step}` : null;
    if (step && this.steps[this.steps.length - 1] !== step) this.steps.push(step);
    const line = v.narration;
    if (line && this.said[this.said.length - 1] !== line.text) this.said.push(line.text);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sock = ioClient(`${WS}/mafia`, {
        auth: { token: this.token, code: this.code, name: this.name },
        transports: ["websocket"],
        reconnection: false,
        timeout: 5000,
      });
      this.sock.on("mafia:state", (v: MafiaView) => this.absorb(v));
      this.sock.on("connect", () => {
        this.sock.emit("mafia:hello", {}, (ack: MafiaView | { error: string }) => {
          if ("error" in ack) return reject(new Error(`hello ${this.name}: ${ack.error}`));
          this.absorb(ack);
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
  get id(): string {
    const id = this.view?.you.userId;
    if (!id) throw new Error(`нет userId у ${this.name}`);
    return id;
  }
  /** Открыто ли сейчас окно хода именно у него. */
  get myWindow(): boolean {
    return Boolean(this.view?.night?.yourTurn && this.view.night.stage === "act");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(
  what: string,
  check: () => boolean,
  timeoutMs = 40000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return;
    await sleep(150);
  }
  throw new Error(`не дождались: ${what}`);
}

const waitPhase = (c: Client, phase: MafiaPhase) =>
  waitFor(`фаза ${phase} (сейчас ${c.phase})`, () => c.phase === phase);

/** Дождаться своего окна и сходить. */
async function actInTurn(
  c: Client,
  action: "mafia" | "doctor" | "sheriff",
  targetId: string,
): Promise<void> {
  await waitFor(`окно хода ${action} у ${c.name}`, () => c.myWindow);
  const resp = (await c.emit("mafia:night_action", { action, targetId })) as {
    error?: string;
  };
  if (resp?.error) throw new Error(`ход ${action} отклонён: ${resp.error}`);
}

async function main(): Promise<void> {
  const clients = NAMES.map((n) => new Client(n));
  for (const c of clients) await c.primeCookie();

  const [host, ...rest] = clients;
  await host.createRoom();
  console.log(`[create] code=${host.code}`);
  for (const c of rest) await c.join(host.code);
  for (const c of clients) await c.connect();

  if (!host.view?.settings.narrator) throw new Error("режим ведущего не включился");

  await host.emit("mafia:start");
  await waitPhase(host, "ROLE_REVEAL");
  for (const c of clients) await c.emit("mafia:ready");
  await waitPhase(host, "NIGHT");

  const mafias = clients.filter((c) => c.role === "mafia" || c.role === "don");
  const sheriff = clients.find((c) => c.role === "sheriff");
  const doctor = clients.find((c) => c.role === "doctor");
  if (!doctor || !sheriff) throw new Error("в раскладе нет доктора или шерифа");
  console.log(`[night 1] ${clients.map((c) => `${c.name}:${c.role}`).join(" ")}`);

  // ─── Ночь начинается с общей команды закрыть глаза ───
  await waitFor("шаг sleep", () => host.view?.night?.step === "sleep");
  if (!host.said.some((t) => t.includes("Город засыпает"))) {
    throw new Error(`ведущий не сказал «город засыпает»: ${JSON.stringify(host.said)}`);
  }

  // ─── Не в своё окно ходить нельзя ───
  await waitFor("шаг мафии", () => host.view?.night?.step === "mafia");
  const early = (await sheriff.emit("mafia:night_action", {
    action: "sheriff",
    targetId: mafias[0].id,
  })) as { error?: string };
  if (early?.error !== "not_your_turn" && early?.error !== "not_yet") {
    throw new Error(`ход мимо очереди прошёл: ${JSON.stringify(early)}`);
  }
  console.log(`[order] шериф в чужой шаг получил «${early.error}»`);

  // ─── Мафия убирает доктора ───
  for (const m of mafias) await actInTurn(m, "mafia", doctor.id);

  // ─── Пока идёт шаг доктора, остаток видит только он ───
  await waitFor("окно хода доктора", () => doctor.myWindow);
  if (!doctor.view?.timer) throw new Error("доктор не видит свой таймер");
  const spectator = clients.find((c) => c.role === "civilian");
  if (spectator?.view?.timer) {
    throw new Error("остаток шага виден залу — по нему вычислят мёртвые роли");
  }
  console.log("[timer] остаток шага виден только ходящему");

  // Лечит не себя: иначе мафия промахнётся и утро будет пустым.
  await actInTurn(doctor, "doctor", sheriff.id);
  await actInTurn(sheriff, "sheriff", mafias[0].id);

  await waitPhase(host, "MORNING");
  const killed = host.view?.spotlight?.map((s) => s.displayName).join(", ");
  console.log(`[morning] погиб: ${killed ?? "никто"}`);
  if (killed !== doctor.name) throw new Error(`ожидали смерть доктора, получили ${killed}`);

  // Первый день без голосования — сразу вторая ночь.
  await waitPhase(host, "DISCUSSION");
  // Обсуждение пропускают все живые разом — кнопка больше не хостовская.
  for (const c of clients) {
    if (c.view?.you.alive && !c.view.you.isSpectator) await c.emit("mafia:skip_discussion");
  }
  await waitPhase(host, "NIGHT");

  // ─── Главная проверка: мёртвого доктора зовут наравне с живыми ───
  await waitFor(
    "шаг доктора во вторую ночь",
    () => host.steps.includes("2:doctor"),
    40000,
  );
  console.log(`[night 2] шаги: ${host.steps.filter((s) => s.startsWith("2:")).join(" → ")}`);
  if (!host.said.some((t) => t.includes("Просыпается доктор"))) {
    throw new Error("ведущий не позвал доктора");
  }
  // Шаг мёртвой роли обязан длиться заметное время, иначе он сам себя выдаёт.
  const deadStepStart = Date.now();
  await waitFor("шаг доктора закончился", () => host.view?.night?.step !== "doctor");
  const deadStepMs = Date.now() - deadStepStart;
  if (deadStepMs < 3000) {
    throw new Error(`шаг мёртвого доктора проскочил за ${deadStepMs}мс — это утечка`);
  }
  console.log(`[dead role] шаг мёртвого доктора занял ${Math.round(deadStepMs / 1000)}с`);

  // ─── Реплика одинакова у всех ───
  const civ = clients.find((c) => c.role === "civilian");
  if (civ && JSON.stringify(civ.view?.narration) !== JSON.stringify(host.view?.narration)) {
    throw new Error("реплики ведущего разошлись между устройствами");
  }

  // Никто во вторую ночь не ходит — ночь всё равно обязана доехать до утра
  // сама, отыграв все шаги по таймерам.
  await waitFor(
    "ночь дошла до утра или финала",
    () => host.phase === "MORNING" || host.phase === "FINISHED",
    60000,
  );
  console.log(`[after night 2] фаза: ${host.phase}`);

  for (const c of clients) c.sock.disconnect();
  console.log("[ok] smoke-narrator passed");
}

main().catch((e) => {
  console.error("[smoke-narrator] FAIL:", e);
  process.exit(1);
});
