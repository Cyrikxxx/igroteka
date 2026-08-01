// Дженерик-хранилище снапшота комнаты в Redis. Обе игры держат один JSON
// на комнату и работают с ним одинаково (load / save / read-modify-write),
// различаются только тип снапшота и ключ.
//
// Клиент Redis передаётся снаружи: web и ws подставляют свой (на деле —
// один и тот же синглтон), а тесты могут подсунуть заглушку.
//
// ВНИМАНИЕ: серверный модуль, в index.ts пакета не реэкспортируется.

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
   * Read-modify-write без блокировок: изменения редкие и в основном
   * исходят от одного игрока, поэтому риск гонки минимален.
   */
  mutate(code: string, fn: (snap: T) => T | void): Promise<T | null>;
  remove(code: string): Promise<void>;
}

export function createSnapshotStore<T extends HasCode>(
  redis: Redis,
  keyFor: (code: string) => string,
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
      ROOM_TTL_SECONDS,
    );
  }

  return {
    load,
    save,
    async mutate(code, fn) {
      const snap = await load(code);
      if (!snap) return null;
      const next = fn(snap) ?? snap;
      await save(next);
      return next;
    },
    async remove(code) {
      await redis.del(keyFor(code));
    },
  };
}
