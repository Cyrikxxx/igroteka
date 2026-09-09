// Хост-зритель: комната не должна оставаться без хозяина.
//
// Раньше хост считался хостом, только пока он в списке игроков. Отсюда две
// беды. Первая: комнату можно было передать зрителю, и тогда `isHostOnline`
// всегда возвращал false — при первом же чьём-то обрыве связи запускался
// отсчёт «комната зависла», и её отбирали у присутствующего хоста. Вторая:
// когда хост уходил, а в комнате оставались одни зрители, наследника не
// находилось вовсе и комната висела до уборки.
//
// Запуск: `npm run smoke:host-spectator -w @alias/ws` при поднятом `npm run dev`.

import "../src/env";
import { io as ioClient, type Socket } from "socket.io-client";
import type { MafiaView } from "@alias/shared/mafia";

const WEB = process.env.SMOKE_WEB ?? "http://localhost:3000";
const WS = process.env.SMOKE_WS ?? "http://localhost:3001";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function assert(ok: boolean, what: string) {
  if (!ok) throw new Error(`ПРОВАЛ: ${what}`);
  console.log(`  ok · ${what}`);
}

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

  async prime(): Promise<void> {
    await this.req("/api/categories");
  }

  async createRoom(): Promise<void> {
    const res = await this.req("/api/mafia/rooms", {
      method: "POST",
      body: JSON.stringify({
        hostName: this.name,
        title: "Smoke хост-зритель",
        settings: { timers: { night: 20, discussion: 30, vote: 15, lastWord: 10 } },
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
      this.sock.on("connect_error", (e) =>
        reject(new Error(`connect ${this.name}: ${e.message}`)),
      );
    });
  }

  emit(event: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve) => this.sock.emit(event, payload, resolve));
  }

  get isHost() {
    return this.view?.you.isHost ?? false;
  }
  get hostOfflineSince() {
    return this.view?.hostOfflineSince ?? null;
  }
}

async function main(): Promise<void> {
  const host = new Client("Хост");
  const players = ["Аня", "Боря", "Вера", "Гена"].map((n) => new Client(n));
  const latecomer = new Client("Зритель");
  const all = [host, ...players];

  for (const c of [...all, latecomer]) await c.prime();
  await host.createRoom();
  for (const c of players) await c.join(host.code);
  for (const c of all) await c.connect();

  await host.emit("mafia:start");
  await sleep(600);
  for (const c of all) await c.emit("mafia:ready");
  await sleep(600);

  // Подсевший после старта попадает в зрители.
  await latecomer.join(host.code);
  await latecomer.connect();
  await sleep(400);
  assert(
    latecomer.view?.you.isSpectator === true,
    "подсевший после старта стал зрителем",
  );

  // ─── Комната передаётся зрителю ───
  const specId = latecomer.view!.you.userId;
  const res = (await host.emit("mafia:transfer_host", { userId: specId })) as
    | { ok: true }
    | { error: string };
  if ("error" in res) throw new Error(`transfer_host: ${res.error}`);
  await sleep(500);
  assert(latecomer.isHost, "зритель получил права хоста");
  assert(!host.isHost, "прежний хост права потерял");

  // ─── Хост-зритель на связи, значит отсчёт «комната зависла» не идёт ───
  // Роняем соединение одного из игроков: раньше именно это запускало отсчёт,
  // потому что хоста искали только среди players и не находили.
  players[0]!.sock.disconnect();
  await sleep(800);
  assert(
    latecomer.hostOfflineSince === null,
    `хост-зритель на связи — отсчёт не идёт (${latecomer.hostOfflineSince})`,
  );
  assert(
    players[1]!.view?.hostOfflineSince == null,
    "и остальные не видят повода забирать комнату",
  );

  // ─── Хост уходит, остаётся только зритель ───
  // Возвращаем комнату игроку, чтобы проверить обратный случай: уходит хост, а
  // наследовать некому, кроме зрителя.
  const back = (await latecomer.emit("mafia:transfer_host", {
    userId: host.view!.you.userId,
  })) as { ok: true } | { error: string };
  if ("error" in back) throw new Error(`transfer обратно: ${back.error}`);
  await sleep(400);
  assert(host.isHost, "комната вернулась игроку");

  // Все игроки выходят: остаётся один зритель.
  for (const c of [host, ...players.slice(1)]) {
    await c.emit("mafia:leave");
    await sleep(250);
  }
  await sleep(700);
  assert(latecomer.isHost, "комната досталась единственному зрителю, а не зависла");

  latecomer.sock.disconnect();
  console.log("[smoke-host-spectator] все проверки зелёные");
}

main().catch((e) => {
  console.error("[smoke-host-spectator] FAIL:", e);
  process.exit(1);
});
