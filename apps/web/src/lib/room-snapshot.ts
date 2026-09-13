// Снимок комнаты Алиаса в Redis (ключ room:<code>, TTL 24ч).
// Механика — @igroteka/shared/server/snapshot-store, построение — snapshot-builders.

import type { RoomSnapshot } from "@igroteka/shared/alias";
import { roomKey } from "@igroteka/shared/redis-keys";
import { createSnapshotStore } from "@igroteka/shared/server/snapshot-store";
import { roomSnapshotTtl } from "@igroteka/shared/snapshot-builders";
import redis from "./redis";

export { buildLobbySnapshot } from "@igroteka/shared/snapshot-builders";

const store = createSnapshotStore<RoomSnapshot>(redis, roomKey, roomSnapshotTtl);

export const saveRoomSnapshot = store.save;
export const loadRoomSnapshot = store.load;
export const deleteRoomSnapshot = store.remove;
