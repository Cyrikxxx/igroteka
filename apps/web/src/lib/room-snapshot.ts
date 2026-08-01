// Снимок комнаты Алиаса в Redis (ключ room:<code>, TTL 24ч).
// Механика — @alias/shared/server/snapshot-store, построение — snapshot-builders.

import type { RoomSnapshot } from "@alias/shared/domain";
import { roomKey } from "@alias/shared/redis-keys";
import { createSnapshotStore } from "@alias/shared/server/snapshot-store";
import redis from "./redis";

export { buildLobbySnapshot } from "@alias/shared/snapshot-builders";

const store = createSnapshotStore<RoomSnapshot>(redis, roomKey);

export const saveRoomSnapshot = store.save;
export const loadRoomSnapshot = store.load;
export const deleteRoomSnapshot = store.remove;
