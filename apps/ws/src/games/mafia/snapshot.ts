// Чтение/запись полного MafiaSnapshot из Redis (ключ mafia:room:<code>).
// Зеркало apps/ws/src/snapshot.ts, но для пространства Мафии.

import { redis } from "../../redis";
import { mafiaRoomKey } from "@alias/shared/redis-keys";
import { ROOM_TTL_SECONDS } from "@alias/shared/constants";
import type { MafiaSnapshot } from "@alias/shared/mafia";

export async function load(code: string): Promise<MafiaSnapshot | null> {
  const raw = await redis.get(mafiaRoomKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MafiaSnapshot;
  } catch {
    return null;
  }
}

export async function save(snapshot: MafiaSnapshot): Promise<void> {
  await redis.set(
    mafiaRoomKey(snapshot.code),
    JSON.stringify(snapshot),
    "EX",
    ROOM_TTL_SECONDS,
  );
}

/** Read-modify-write. Лобби/ходы редкие — без блокировок (как у Алиаса). */
export async function mutate(
  code: string,
  fn: (snap: MafiaSnapshot) => MafiaSnapshot | void,
): Promise<MafiaSnapshot | null> {
  const snap = await load(code);
  if (!snap) return null;
  const next = fn(snap) ?? snap;
  await save(next);
  return next;
}
