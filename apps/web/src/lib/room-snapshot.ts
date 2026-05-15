// Сохранение/чтение снимка комнаты в Redis. Ключ: `room:<code>`. TTL 24ч.
// Логика построения вынесена в @alias/shared/snapshot-builders.

import type { RoomSnapshot } from "@alias/shared/domain";
import { ROOM_TTL_SECONDS } from "@alias/shared/constants";
import { roomKey } from "@alias/shared/redis-keys";
import redis from "./redis";

export { buildLobbySnapshot } from "@alias/shared/snapshot-builders";

export async function saveRoomSnapshot(snapshot: RoomSnapshot): Promise<void> {
  await redis.set(
    roomKey(snapshot.code),
    JSON.stringify(snapshot),
    "EX",
    ROOM_TTL_SECONDS,
  );
}

export async function loadRoomSnapshot(
  code: string,
): Promise<RoomSnapshot | null> {
  const raw = await redis.get(roomKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoomSnapshot;
  } catch {
    return null;
  }
}

export async function deleteRoomSnapshot(code: string): Promise<void> {
  await redis.del(roomKey(code));
}
