// Дженерик-хранилище снапшота комнаты в Redis. Обе игры держат один JSON
// на комнату и работают с ним одинаково (load / save / read-modify-write),
// различаются только тип снапшота и ключ.
//
// Клиент Redis передаётся снаружи: web и ws подставляют свой (на деле —
// один и тот же синглтон), а тесты могут подсунуть заглушку.
//
// ВНИМАНИЕ: серверный модуль, в index.ts пакета не реэкспортируется.

import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { ROOM_TTL_SECONDS } from "../constants";

/** Снапшот обязан знать свой код комнаты — из него строится ключ Redis. */
interface HasCode {
  code: string;
}

export interface SnapshotStore<T extends HasCode> {
  load(code: string): Promise<T | null>;
  save(snapshot: T): Promise<void>;
  /**
   * Read-modify-write под блокировкой комнаты: параллельные мутации
   * выстраиваются в очередь, а не затирают друг друга.
   */
  mutate(code: string, fn: (snap: T) => T | void): Promise<T | null>;
  remove(code: string): Promise<void>;
}

/** Лок держится недолго: мутация — это чтение, чистая функция и запись. */
const LOCK_TTL_MS = 5_000;
const LOCK_RETRY_MS = 20;
const LOCK_MAX_WAIT_MS = 2_000;

// Снимаем только свой лок: чужой мог быть взят после истечения нашего TTL.
const UNLOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createSnapshotStore<T extends HasCode>(
  redis: Redis,
  keyFor: (code: string) => string,
  /**
   * Сколько секунд жить ключу. Считается на каждой записи, поэтому комната,
   * из которой все ушли, доживает минуты, а вернувшийся человек сам продлевает
   * её обратно до суток. Без этого «короткий TTL для пустой» не работал бы:
   * любая следующая запись возвращала бы сутки.
   */
  ttlFor: (snapshot: T) => number = () => ROOM_TTL_SECONDS,
): SnapshotStore<T> {
  async function load(code: string): Promise<T | null> {
    const raw = await redis.get(keyFor(code));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async function save(snapshot: T): Promise<void> {
    await redis.set(
      keyFor(snapshot.code),
      JSON.stringify(snapshot),
      "EX",
      ttlFor(snapshot),
    );
  }

  /**
   * Выполняет fn, держа лок на комнату. Если лок за отведённое время взять
   * не удалось — идём без него: потерянное обновление лучше, чем комната,
   * зависшая навсегда из-за чужого протухшего лока.
   */
  async function withLock<R>(code: string, fn: () => Promise<R>): Promise<R> {
    const lockKey = `${keyFor(code)}:lock`;
    const token = randomUUID();
    const deadline = Date.now() + LOCK_MAX_WAIT_MS;
    let held = false;

    while (Date.now() < deadline) {
      const ok = await redis.set(lockKey, token, "PX", LOCK_TTL_MS, "NX");
      if (ok) {
        held = true;
        break;
      }
      await sleep(LOCK_RETRY_MS);
    }
    if (!held) {
      console.warn(`[snapshot] не дождались лока ${lockKey}, пишем без него`);
    }

    try {
      return await fn();
    } finally {
      if (held) {
        await redis.eval(UNLOCK_SCRIPT, 1, lockKey, token).catch(() => {});
      }
    }
  }

  return {
    load,
    save,
    mutate(code, fn) {
      return withLock(code, async () => {
        const snap = await load(code);
        if (!snap) return null;
        const next = fn(snap) ?? snap;
        await save(next);
        return next;
      });
    },
    async remove(code) {
      await redis.del(keyFor(code));
    },
  };
}
