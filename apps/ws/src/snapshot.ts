// Чтение/запись RoomSnapshot из Redis. Зеркало apps/web/src/lib/room-snapshot.ts,
// но использует локальный ioredis (apps/ws/src/redis.ts).

import { redis } from "./redis";
import { roomKey } from "@alias/shared/redis-keys";
import { ROOM_TTL_SECONDS } from "@alias/shared/constants";
import type { RoomSnapshot } from "@alias/shared/domain";

export async function load(code: string): Promise<RoomSnapshot | null> {
  const raw = await redis.get(roomKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomSnapshot;
  } catch {
    return null;
  }
}

export async function save(snapshot: RoomSnapshot): Promise<void> {
  await redis.set(
    roomKey(snapshot.code),
    JSON.stringify(snapshot),
    "EX",
    ROOM_TTL_SECONDS,
  );
}

/**
 * Read-modify-write без блокировок: для лобби риск гонки минимален
 * (изменения редкие и делает их в основном хост).
 */
export async function mutate(
  code: string,
  fn: (snap: RoomSnapshot) => RoomSnapshot | void,
): Promise<RoomSnapshot | null> {
  const snap = await load(code);
  if (!snap) return null;
  const next = fn(snap) ?? snap;
  await save(next);
  return next;
}
