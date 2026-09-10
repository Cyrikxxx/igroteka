// Наполнить онлайн-комнату Мафии ботами — чтобы посмотреть глазами на большой стол.
//
// Шестнадцать телефонов ради проверки вёрстки взять негде, а сетка карточек,
// экран ночи и голосование на пятерых и на шестнадцати выглядят по-разному.
// Скрипт подсаживает в вашу комнату столько живых сокет-клиентов, сколько
// нужно, и дальше они играют сами: подтверждают роль, ходят ночью, голосуют
// днём. Вы остаётесь обычным игроком — смотрите со своего экрана.
//
// Боты выбирают цели случайно и голосуют вразнобой: партия должна двигаться,
// а не выигрываться.
//
// Запуск (комната уже создана в браузере, вы в лобби):
//   npm run mafia:fill -w @alias/ws -- K7F2QD 16
// Второй аргумент — сколько игроков должно оказаться за столом всего,
// считая вас. По умолчанию 16, максимум тоже 16.
//
// Боты живут, пока скрипт не остановлен. Ctrl+C — все выходят из комнаты.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { MafiaView } from "@alias/shared/mafia";
import { MAX_MAFIA_PLAYERS } from "@alias/shared/mafia";

const WEB = process.env.SMOKE_WEB ?? "http://localhost:3000";
const WS = process.env.SMOKE_WS ?? process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

const NAMES = [
  "Аня", "Боря", "Вера", "Гена", "Даша", "Егор", "Жанна", "Захар",
  "Ира", "Костя", "Лена", "Миша", "Нина", "Олег", "Поля", "Рома",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T,>(xs: T[]): T | undefined => xs[Math.floor(Math.random() * xs.length)];

class Bot {
  readonly name: string;
  private cookie = "";
  private token = "";
  private code = "";
  private sock!: Socket;
  view: MafiaView | null = null;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Запрос, умеющий подождать, когда сервер просит.
   *
   * Вход в комнату ограничен двадцатью запросами в минуту с адреса, а боты
   * приходят все с одного. Без ожидания наполнение большого стола обрывалось
   * на двадцать первом невнятным «не зашёл: 429».
   */
  private async req(path: string, init?: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${WEB}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(this.cookie ? { cookie: this.cookie } : {}),
        },
      });
      const sc = res.headers.get("set-cookie");
      if (sc) {
        const m = sc.match(/^([^=]+)=([^;]+)/);
        if (m) this.cookie = `${m[1]}=${m[2]}`;
      }
      if (res.status !== 429 || attempt >= 3) return res;
      const wait = (Number(res.headers.get("Retry-After")) || 60) + 1;
      console.log(`  … лимит запросов исчерпан, ждём ${wait} с`);
      await sleep(wait * 1000);
    }
  }

  async join(code: string): Promise<void> {
    // Кука `aid` подписана сервером — за ней и ходим первым запросом.
    await this.req("/api/categories");
    const res = await this.req(`/api/mafia/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName: this.name }),
    });
    if (!res.ok) throw new Error(`${this.name} не зашёл: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { wsToken: string };
    this.code = code;
    this.token = data.wsToken;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sock = ioClient(`${WS}/mafia`, {
        auth: { token: this.token, code: this.code, name: this.name },
        transports: ["websocket"],
        reconnection: true,
        timeout: 5000,
      });
      this.sock.on("mafia:state", (v: MafiaView) => {
        this.view = v;
        void this.react();
      });
      this.sock.on("connect", () => {
        this.sock.emit("mafia:hello", {}, (ack: MafiaView | { error: string }) => {
          if ("error" in ack) return reject(new Error(`${this.name}: ${ack.error}`));
          this.view = ack;
          resolve();
        });
      });
      this.sock.on("connect_error", (e) => reject(new Error(`${this.name}: ${e.message}`)));
    });
  }

  /** Что бот уже сделал в этой фазе — чтобы не слать одно и то же на каждый снимок. */
  private done = "";

  private async react(): Promise<void> {
    const v = this.view;
    if (!v) return;
    const stamp = `${v.phase}:${v.day}`;
    if (this.done === stamp) return;

    const me = v.you;
    if (v.phase === "ROLE_REVEAL") {
      this.done = stamp;
      await sleep(200 + Math.random() * 800);
      this.sock.emit("mafia:ready", {}, () => {});
      return;
    }
    if (!me.alive || me.isSpectator) return;

    const others = v.players.filter((p) => p.alive && p.userId !== me.userId);

    if (v.phase === "NIGHT") {
      const role = me.role;
      if (role !== "mafia" && role !== "don" && role !== "doctor" && role !== "sheriff" && role !== "maniac")
        return;
      this.done = stamp;
      await sleep(600 + Math.random() * 2500);
      const action = role === "don" ? "mafia" : role;
      // Своих не трогаем: сервер такой ход всё равно не примет.
      const allies = new Set(me.partnerIds ?? []);
      const pool =
        action === "mafia" ? others.filter((p) => !allies.has(p.userId)) : others;
      const target = pick(pool);
      if (target) this.sock.emit("mafia:night_action", { action, targetId: target.userId }, () => {});
      return;
    }

    if (v.phase === "VOTE") {
      this.done = stamp;
      await sleep(800 + Math.random() * 3000);
      const target = pick(others);
      if (target) this.sock.emit("mafia:vote", { targetId: target.userId }, () => {});
      return;
    }

    if (v.phase === "LAST_WORD" && v.spotlight?.some((sp) => sp.userId === me.userId)) {
      this.done = stamp;
      await sleep(1200);
      this.sock.emit("mafia:last_word_done", {}, () => {});
    }
  }

  leave(): void {
    try {
      this.sock.emit("mafia:leave", {}, () => {});
      this.sock.disconnect();
    } catch {}
  }
}

async function main(): Promise<void> {
  const code = (process.argv[2] ?? "").toUpperCase();
  const total = Math.min(Number(process.argv[3] ?? MAX_MAFIA_PLAYERS), MAX_MAFIA_PLAYERS);
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    console.error("Укажите код комнаты: npm run mafia:fill -w @alias/ws -- K7F2QD 16");
    process.exit(1);
  }
  // Одно место ваше — вы уже в комнате.
  const want = Math.max(0, total - 1);
  if (want === 0) {
    console.error("За столом должно быть больше одного игрока.");
    process.exit(1);
  }

  const bots = NAMES.slice(0, want).map((n) => new Bot(n));
  for (const b of bots) {
    await b.join(code);
    await b.connect();
    console.log(`  + ${b.name}`);
    // Вход по одному: у входа в комнату лимит запросов.
    await sleep(400);
  }
  console.log(`\n[fill] в комнате ${code} ботов: ${bots.length} (+ вы = ${bots.length + 1})`);
  console.log("[fill] жмите «Начать» в браузере. Боты играют сами.");
  console.log("[fill] Ctrl+C — боты выйдут из комнаты.\n");

  const bye = () => {
    for (const b of bots) b.leave();
    setTimeout(() => process.exit(0), 400);
  };
  process.on("SIGINT", bye);
  process.on("SIGTERM", bye);
  // Держим процесс живым: боты работают на событиях сокета.
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error("[fill] FAIL:", e);
  process.exit(1);
});
