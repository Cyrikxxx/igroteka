// Наполнить онлайн-комнату Алиаса ботами — чтобы посмотреть глазами на
// большой состав.
//
// Тридцати шести телефонов ради проверки вёрстки взять негде, а лобби на
// четверых и на четырёх командах по шесть человек выглядят по-разному. Скрипт
// подсаживает в вашу комнату живых сокет-клиентов, рассаживает их по
// свободным местам и дальше они играют сами: когда очередь объяснять доходит
// до бота, он отвечает на слова и подтверждает итог раунда.
//
// Команды создаёт только хост, поэтому создайте их сами в лобби — боты займут
// свободные места. Не хватило мест — скрипт скажет, сколько ещё нужно.
//
// Боты отвечают наугад: партия должна двигаться, а не выигрываться.
//
// Запуск (комната уже создана в браузере, вы в лобби):
//   npm run alias:fill -w @alias/ws -- K7F2QD 12
// Второй аргумент — сколько игроков должно оказаться в комнате всего, считая
// вас. По умолчанию 12.
//
// Боты живут, пока скрипт не остановлен. Ctrl+C — все выходят из комнаты.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type {
  RoomSnapshot,
  RoundPhasePayload,
  RoundWordPayload,
} from "@alias/shared/domain";
import { MAX_TEAMS, MAX_PLAYERS_PER_TEAM } from "@alias/shared/constants";
import { teamCapacity } from "@alias/shared/snapshot-builders";

const WEB = process.env.SMOKE_WEB ?? "http://localhost:3000";
const WS = process.env.SMOKE_WS ?? process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

const MAX_PLAYERS = MAX_TEAMS * MAX_PLAYERS_PER_TEAM;

const NAMES = [
  "Аня", "Боря", "Вера", "Гена", "Даша", "Егор", "Жанна", "Захар",
  "Ира", "Костя", "Лена", "Миша", "Нина", "Олег", "Поля", "Рома",
  "Света", "Тимур", "Ульяна", "Фёдор", "Хава", "Цветана", "Чулпан", "Шура",
  "Эля", "Юра", "Яна", "Алиса", "Богдан", "Влад", "Галя", "Дима",
  "Ева", "Женя", "Зина",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Bot {
  readonly name: string;
  private cookie = "";
  private token = "";
  private code = "";
  private sock!: Socket;
  private userId = "";
  snap: RoomSnapshot | null = null;

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
    const res = await this.req(`/api/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName: this.name }),
    });
    if (!res.ok) throw new Error(`${this.name} не зашёл: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { user: { id: string }; wsToken: string };
    this.code = code;
    this.token = data.wsToken;
    this.userId = data.user.id;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sock = ioClient(`${WS}/room`, {
        auth: { token: this.token, code: this.code, name: this.name },
        transports: ["websocket"],
        reconnection: true,
        timeout: 5000,
      });
      this.sock.on("room:state", (s: RoomSnapshot) => {
        this.snap = s;
        void this.onPhase(s.phase);
      });
      this.sock.on("round:phase", (p: RoundPhasePayload) => void this.onPhase(p.phase));
      // Слово приходит только объясняющему — значит ход наш.
      this.sock.on("round:word", (w: RoundWordPayload) => void this.answer(w));
      this.sock.on("connect", () => {
        this.sock.emit("room:hello", {}, (ack: RoomSnapshot | { error: string }) => {
          if ("error" in ack) return reject(new Error(`${this.name}: ${ack.error}`));
          this.snap = ack;
          resolve();
        });
      });
      this.sock.on("connect_error", (e) => reject(new Error(`${this.name}: ${e.message}`)));
    });
  }

  /** Сесть в команду. Вызывается один раз при рассадке. */
  sit(teamId: number): Promise<void> {
    return new Promise((resolve) => {
      this.sock.emit("team:join", { teamId }, () => resolve());
    });
  }

  /** Что бот уже сделал в этой фазе — чтобы не слать одно и то же дважды. */
  private done = "";

  private async onPhase(phase: string): Promise<void> {
    const s = this.snap;
    if (!s) return;
    if (phase !== "ROUND_REVIEW") return;
    // Итог подтверждает только объяснявший — остальным сервер откажет.
    if (s.currentPlayerId !== this.userId) return;
    const stamp = `review:${s.currentRoundNumber}`;
    if (this.done === stamp) return;
    this.done = stamp;
    await sleep(1500 + Math.random() * 2000);
    this.sock.emit("round:review_confirm", {}, () => {});
  }

  /** Ответ на слово: угадали или пропустили. Следующее придёт событием. */
  private async answer(w: RoundWordPayload): Promise<void> {
    // Пауза между словами — иначе бот проносится по колоде за секунду и
    // раунд превращается в мельтешение, по которому ничего не разглядеть.
    await sleep(1800 + Math.random() * 2200);
    this.sock.emit(
      "round:guess",
      { wordId: w.wordId, guessed: Math.random() < 0.7 },
      () => {},
    );
  }

  leave(): void {
    try {
      this.sock.emit("room:leave", {}, () => {});
      this.sock.disconnect();
    } catch {}
  }
}

/** Свободные места по командам: [teamId, сколько влезет ещё]. */
function freeSeats(s: RoomSnapshot): [number, number][] {
  const cap = teamCapacity(s.format);
  return s.teams.map((t) => [t.id, Math.max(0, cap - t.players.length)]);
}

async function main(): Promise<void> {
  const code = (process.argv[2] ?? "").toUpperCase();
  const total = Math.min(Number(process.argv[3] ?? 12), MAX_PLAYERS);
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    console.error("Укажите код комнаты: npm run alias:fill -w @alias/ws -- K7F2QD 12");
    process.exit(1);
  }
  // Одно место ваше — вы уже в комнате.
  const want = Math.max(0, total - 1);
  if (want === 0) {
    console.error("В комнате должно быть больше одного игрока.");
    process.exit(1);
  }

  // Первый бот заходит, чтобы посмотреть на комнату: сколько там команд и
  // сколько в них мест. Команды создаёт только хост, и подстроиться под них —
  // единственное, что мы можем.
  const scout = new Bot(NAMES[0]!);
  await scout.join(code);
  await scout.connect();
  const snap = scout.snap!;
  if (snap.phase !== "LOBBY") {
    console.error(`Комната не в лобби, а в фазе ${snap.phase}. Боты садятся только до старта.`);
    scout.leave();
    process.exit(1);
  }

  const seats = freeSeats(snap);
  const free = seats.reduce((n, [, k]) => n + k, 0);
  if (free === 0) {
    console.error(
      snap.teams.length === 0
        ? "В комнате нет команд. Создайте их в лобби — команды заводит только хост."
        : "Свободных мест нет. Добавьте команду в лобби.",
    );
    scout.leave();
    process.exit(1);
  }
  if (free < want) {
    console.log(
      `[fill] свободных мест ${free}, а просили ${want} ботов — посадим сколько влезет.`,
    );
    console.log("[fill] чтобы вошли все, добавьте команд в лобби и запустите заново.\n");
  }

  // Рассаживаем по кругу: команды заполняются равномерно, а не первая доверху.
  const plan: number[] = [];
  const left = new Map(seats);
  while (plan.length < Math.min(want, free)) {
    let placed = false;
    for (const [teamId] of seats) {
      if (plan.length >= Math.min(want, free)) break;
      const k = left.get(teamId) ?? 0;
      if (k <= 0) continue;
      plan.push(teamId);
      left.set(teamId, k - 1);
      placed = true;
    }
    if (!placed) break;
  }

  const bots: Bot[] = [scout];
  await scout.sit(plan[0]!);
  console.log(`  + ${scout.name} → команда ${plan[0]}`);

  for (let i = 1; i < plan.length; i++) {
    const b = new Bot(NAMES[i % NAMES.length]!);
    await b.join(code);
    await b.connect();
    await b.sit(plan[i]!);
    bots.push(b);
    console.log(`  + ${b.name} → команда ${plan[i]}`);
    // Вход по одному: у входа в комнату лимит запросов.
    await sleep(400);
  }

  console.log(`\n[fill] в комнате ${code} ботов: ${bots.length} (+ вы = ${bots.length + 1})`);
  console.log("[fill] жмите «Начать игру» в браузере. Боты играют сами.");
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
